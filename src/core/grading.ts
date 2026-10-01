// I voti che servono in un periodo e quanti ne sono già previsti (ADR 0005). ProfClick non
// conosce i voti dei singoli studenti: conta le valutazioni della classe, cioè le occasioni
// in cui ognuno prende un voto.

import { isAvailable, periodSlots } from './calendar'
import type { ISODate } from './dates'
import { type Activity, type Course, type GradeType, isMinor, type Period, type PlannedAssessment, type ProfclickData, type Topic, weeklyHours } from './model'

export interface GradeEvent {
  /** null per una valutazione segnata come fatta dal programma, senza lezione. */
  date: ISODate | null
  activity: Activity
  type: GradeType
  weight: number
  done: boolean
}

export interface PeriodGrades {
  /** Voti pieni richiesti nel periodo. */
  target: number
  /** Valutazioni piene in calendario (fatte o no) o spuntate nel programma, escluse le prosecuzioni. */
  full: GradeEvent[]
  minor: GradeEvent[]
  done: number
  /** Valutazioni previste nel programma e non ancora in calendario. */
  unplaced: { topic: Topic; planned: PlannedAssessment }[]
  /** Voti pieni ancora da mettere in calendario. */
  missing: number
  /** Tipi richiesti che non compaiono ancora nel piano. */
  missingTypes: GradeType[]
  /** Lezioni e ore da oggi alla fine del periodo, escluse quelle annullate. */
  remainingLessons: number
  remainingHours: number
  /** Lezioni future ancora vuote, dove si può mettere qualcosa. */
  freeLessons: number
  civics: { target: number; planned: number; done: number }
  status: 'ok' | 'da-pianificare' | 'a-rischio'
}

export function targetGrades(course: Course): number {
  return course.rules.perPeriod ?? Math.max(weeklyHours(course), course.rules.required.length)
}

/** Le valutazioni previste già messe in calendario, con la lezione in cui cadono. */
export function placedAssessments(data: ProfclickData, courseId: string): Map<string, { date: ISODate; done: boolean }> {
  const placed = new Map<string, { date: ISODate; done: boolean }>()
  for (const lesson of Object.values(data.lessons)) {
    if (lesson.courseId !== courseId || lesson.cancelled) continue
    for (const a of lesson.activities) if (a.assessment?.plannedId) placed.set(a.assessment.plannedId, { date: lesson.date, done: lesson.done })
  }
  return placed
}

export function periodGrades(data: ProfclickData, course: Course, period: Period, today: ISODate): PeriodGrades {
  const slots = periodSlots(data, course, period).filter(isAvailable)
  const full: GradeEvent[] = []
  const minor: GradeEvent[] = []
  const civics = { target: course.civics[period.id] ?? 0, planned: 0, done: 0 }

  for (const slot of slots) {
    const activities = slot.lesson?.activities ?? []
    for (const activity of activities) {
      if (activity.kind === 'civica') {
        const hours = slot.hours / activities.length
        civics.planned += hours
        if (slot.lesson?.done) civics.done += hours
      }
      const a = activity.assessment
      if (activity.kind !== 'verifica' || !a) continue
      if (a.continues) continue
      const event = { date: slot.date, activity, type: a.type, weight: a.weight, done: slot.lesson?.done ?? false }
      ;(isMinor(a) ? minor : full).push(event)
    }
  }

  // Le valutazioni previste nel programma di questo periodo e non messe in calendario in
  // nessun periodo (una verifica slittata al periodo dopo resta collocata): quelle spuntate
  // come fatte contano, senza data; le altre sono ancora da collocare.
  const placed = placedAssessments(data, course.id)
  const unplaced: PeriodGrades['unplaced'] = []
  const periodTopics = Object.values(data.topics)
    .filter((t) => t.courseId === course.id && t.periodId === period.id)
    .sort((a, b) => a.order - b.order)
  for (const topic of periodTopics) {
    for (const planned of topic.assessments) {
      if (placed.has(planned.id)) continue
      if (!planned.done) {
        unplaced.push({ topic, planned })
        continue
      }
      const assessment = { type: planned.type, weight: planned.weight, continues: false, plannedId: planned.id }
      const activity: Activity = { id: planned.id, kind: 'verifica', topicIds: [topic.id], text: planned.text, assessment }
      ;(isMinor(planned) ? minor : full).push({ date: null, activity, type: planned.type, weight: planned.weight, done: true })
    }
  }

  const target = targetGrades(course)
  const upcoming = slots.filter((s) => s.date >= today && !s.lesson?.done)
  const missing = Math.max(0, target - full.length)
  const missingTypes = course.rules.required.filter((t) => !full.some((g) => g.type === t))
  const freeLessons = upcoming.filter((s) => !s.lesson?.activities.length).length
  const civicsMissing = civics.planned < civics.target - 0.01
  // Non basta che ci sia posto: servono abbastanza lezioni libere anche per spiegare.
  const needed = Math.max(missing, missingTypes.length) + (civicsMissing ? 1 : 0)
  const status = needed === 0 ? 'ok' : freeLessons >= needed * 2 ? 'da-pianificare' : 'a-rischio'

  return {
    target,
    full,
    minor,
    done: full.filter((g) => g.done).length,
    unplaced,
    missing,
    missingTypes,
    remainingLessons: upcoming.length,
    remainingHours: upcoming.reduce((sum, s) => sum + s.hours, 0),
    freeLessons,
    civics,
    status,
  }
}
