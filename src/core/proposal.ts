// La proposta di piano per un periodo (ADR 0006): riempie le lezioni future ancora vuote
// seguendo il programma. Ogni argomento occupa le sue ore stimate, seguito dalle
// valutazioni previste per lui; se i voti non bastano, se ne aggiungono altri a intervalli
// regolari, e così le ore di educazione civica. È solo una proposta: il docente la vede
// tratteggiata e decide se applicarla.

import { isAvailable, type LessonSlot, periodSlots } from './calendar'
import type { ISODate } from './dates'
import { periodGrades } from './grading'
import { type Activity, type Course, type GradeType, isMinor, type Period, type PlannedAssessment, type ProfclickData, type Topic } from './model'
import { courseTopics, topicProgress, topicsSinceLastAssessment } from './progress'

export interface ProposedLesson {
  date: ISODate
  hours: number
  activity: Activity
}

export interface Proposal {
  lessons: ProposedLesson[]
  /** Ore di programma che non ci stanno nel periodo. */
  overflowHours: number
  /** Valutazioni previste nel programma che non ci stanno. */
  overflowAssessments: number
  /** Lezioni rimaste libere: margine per ripassi e recuperi. */
  spareLessons: number
  assessments: number
}

/** Quota del periodo dopo cui non si mettono valutazioni aggiunte: l'ultimo tratto serve ai recuperi. */
const LAST_ASSESSMENT_AT = 0.92

/**
 * I tipi di valutazione da aggiungere: prima quelli richiesti e mancanti, poi a rotazione,
 * scegliendo il tipo finora meno usato.
 */
export function assessmentTypes(course: Course, existing: GradeType[], count: number): GradeType[] {
  const used = { scritto: 0, teorico: 0, pratico: 0 }
  for (const t of existing) used[t]++
  const result: GradeType[] = []
  for (const t of course.rules.required) {
    if (result.length < count && used[t] === 0) {
      result.push(t)
      used[t]++
    }
  }
  const rotation = course.rules.required.length > 0 ? course.rules.required : (['scritto', 'teorico', 'pratico'] as GradeType[])
  while (result.length < count) {
    const next = [...rotation].sort((a, b) => used[a] - used[b])[0]
    result.push(next)
    used[next]++
  }
  return result
}

type QueueItem = { kind: 'teach'; topic: Topic; left: number } | { kind: 'assess'; topic: Topic; planned: PlannedAssessment }
type Extra = { at: number } & ({ kind: 'verifica'; type: GradeType } | { kind: 'civica' })

/** Posizioni equidistanti, in ore dall'inizio, lungo il tratto occupato dal programma. */
function marks(totalHours: number, programHours: number, count: number, lessonHours: number): number[] {
  const span = Math.min(totalHours, (programHours + count * lessonHours) / LAST_ASSESSMENT_AT)
  const usable = span * LAST_ASSESSMENT_AT
  return Array.from({ length: count }, (_, i) => (usable * (i + 1)) / count)
}

let seq = 0
const proposalId = () => `prop-${Date.now().toString(36)}-${(seq++).toString(36)}`

/** Scritti e prove pratiche vogliono il posto giusto: il laboratorio per il pratico, una lezione lunga per lo scritto. */
function betterLater(type: GradeType, slot: LessonSlot, following: LessonSlot[]): boolean {
  if (type === 'pratico') return !slot.lab && following.slice(0, 2).some((s) => s.lab)
  if (type === 'scritto') return slot.hours < 2 && (following[0]?.hours ?? 0) > slot.hours
  return false
}

export function proposePlan(data: ProfclickData, course: Course, period: Period, today: ISODate): Proposal {
  const free: LessonSlot[] = periodSlots(data, course, period).filter(
    (s) => s.date >= today && isAvailable(s) && !s.lesson?.done && !s.lesson?.activities.length,
  )
  const grades = periodGrades(data, course, period, today)
  const progress = new Map(topicProgress(data, course).map((p) => [p.topic.id, p]))
  const unplaced = new Set(grades.unplaced.map((u) => u.planned.id))

  // Il programma del periodo in sequenza: ore di spiegazione, poi le valutazioni previste.
  const queue: QueueItem[] = []
  for (const topic of courseTopics(data, course.id)) {
    if (topic.periodId !== period.id && topic.periodId !== null) continue
    // Un argomento concluso non si spiega più, ma le sue valutazioni non fatte restano da mettere.
    const left = topic.completed ? 0 : Math.max(0, topic.hours - (progress.get(topic.id)?.plannedHours ?? 0))
    if (left > 0) queue.push({ kind: 'teach', topic, left })
    for (const planned of topic.assessments) if (unplaced.has(planned.id)) queue.push({ kind: 'assess', topic, planned })
  }
  const explicit = queue.flatMap((q) => (q.kind === 'assess' && !isMinor(q.planned) ? [q.planned.type] : []))

  // Voti aggiunti: quelli che mancano al minimo anche contando le valutazioni previste.
  const existing = [...grades.full.map((g) => g.type), ...explicit]
  const missingTypes = course.rules.required.filter((t) => !existing.includes(t)).length
  const autoCount = Math.min(Math.max(grades.target - existing.length, missingTypes), free.length)
  const autoTypes = assessmentTypes(course, existing, Math.max(0, autoCount))

  const totalHours = free.reduce((sum, s) => sum + s.hours, 0)
  const lessonHours = free.length ? totalHours / free.length : 0
  const programHours = queue.reduce((sum, q) => sum + (q.kind === 'teach' ? q.left : lessonHours), 0)
  const civicLessons = lessonHours ? Math.ceil(Math.max(0, grades.civics.target - grades.civics.planned) / lessonHours - 0.01) : 0
  const extras: Extra[] = [
    ...marks(totalHours, programHours, autoTypes.length, lessonHours).map((at, i) => ({ at, kind: 'verifica' as const, type: autoTypes[i] })),
    // L'educazione civica si sparge a metà dei tratti, per non accavallarsi con le verifiche.
    ...marks(totalHours, programHours, civicLessons, lessonHours).map((at) => ({ at: at - (programHours / Math.max(civicLessons, 1)) / 2, kind: 'civica' as const })),
  ].sort((a, b) => a.at - b.at)

  const lessons: ProposedLesson[] = []
  const taughtSince: string[] = topicsSinceLastAssessment(data, course, free[0]?.date ?? today)
  let elapsed = 0
  let placedAssessments = 0
  const place = (slot: LessonSlot, activity: Omit<Activity, 'id'>) => lessons.push({ date: slot.date, hours: slot.hours, activity: { id: proposalId(), ...activity } })

  for (let i = 0; i < free.length; i++) {
    const slot = free[i]
    const following = free.slice(i + 1)
    const extra = extras[0]
    const due = extra && elapsed + slot.hours >= extra.at
    const mustPlace = extra && free.length - i <= extras.length
    const item = queue[0]

    if (extra && ((due && !(extra.kind === 'verifica' && betterLater(extra.type, slot, following))) || mustPlace)) {
      extras.shift()
      if (extra.kind === 'civica') {
        place(slot, { kind: 'civica', topicIds: [], text: '' })
      } else {
        place(slot, { kind: 'verifica', topicIds: [...taughtSince], text: '', assessment: { type: extra.type, weight: 100, continues: false } })
        taughtSince.length = 0
        placedAssessments++
      }
    } else if (item?.kind === 'assess') {
      if (betterLater(item.planned.type, slot, following)) {
        // Si aspetta il laboratorio facendo un ripasso di quello che si verificherà.
        place(slot, { kind: 'ripasso', topicIds: [item.topic.id], text: '' })
      } else {
        queue.shift()
        const topicIds = item.topic.hours > 0 ? [item.topic.id] : [...taughtSince]
        const { type, weight, text, id } = item.planned
        place(slot, { kind: 'verifica', topicIds, text, assessment: { type, weight, continues: false, plannedId: id } })
        if (!isMinor(item.planned)) taughtSince.length = 0
        placedAssessments++
      }
    } else if (item?.kind === 'teach') {
      place(slot, { kind: 'spiegazione', topicIds: [item.topic.id], text: '' })
      if (!taughtSince.includes(item.topic.id)) taughtSince.push(item.topic.id)
      item.left -= slot.hours
      if (item.left <= 0.01) queue.shift()
    }
    elapsed += slot.hours
  }

  const planned = new Set(lessons.map((l) => l.date))
  return {
    lessons,
    overflowHours: queue.reduce((sum, q) => sum + (q.kind === 'teach' ? q.left : 0), 0),
    overflowAssessments: queue.filter((q) => q.kind === 'assess').length,
    spareLessons: free.filter((s) => !planned.has(s.date)).length,
    assessments: placedAssessments,
  }
}
