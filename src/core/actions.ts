// Le modifiche ai dati, come funzioni pure: ricevono il documento e ne restituiscono uno
// nuovo. Ogni record toccato riceve un updatedAt nuovo, che serve all'unione tra dispositivi.

import { courseSlots, isAvailable } from './calendar'
import { addDays, type ISODate } from './dates'
import { tombstone } from './merge'
import {
  type Activity,
  type Collection,
  type Course,
  type Lesson,
  lessonKey,
  type PastSchedule,
  type ProfclickData,
  sameSchedule,
  scheduleAt,
  type ScheduleSlot,
  type SchoolYear,
  type Stamped,
  type Topic,
} from './model'
import type { ProposedLesson } from './proposal'

export type Change = (data: ProfclickData) => ProfclickData

/** Un istante sempre successivo all'ultima modifica e all'eventuale cancellazione del record. */
function stamp(data: ProfclickData, collection: Collection, key: string, previous?: { updatedAt: number }): number {
  return Math.max(Date.now(), (previous?.updatedAt ?? 0) + 1, (data.deleted[tombstone(collection, key)] ?? 0) + 1)
}

function put<C extends Collection>(data: ProfclickData, collection: C, key: string, value: ProfclickData[C][string]): ProfclickData {
  const previous = data[collection][key]
  const record = { ...value, updatedAt: stamp(data, collection, key, previous) }
  return { ...data, [collection]: { ...data[collection], [key]: record } }
}

function remove(data: ProfclickData, collection: Collection, keys: string[]): ProfclickData {
  if (keys.length === 0) return data
  const records = { ...data[collection] }
  const deleted = { ...data.deleted }
  const now = Date.now()
  for (const key of keys) {
    delete records[key]
    deleted[tombstone(collection, key)] = Math.max(now, (data[collection][key]?.updatedAt ?? 0) + 1)
  }
  return { ...data, [collection]: records, deleted }
}

// --- Anno -------------------------------------------------------------------------------

export function setYear(year: Omit<SchoolYear, 'updatedAt'>): Change {
  return (data) => ({ ...data, year: { ...year, updatedAt: Math.max(Date.now(), (data.year?.updatedAt ?? 0) + 1) } })
}

// --- Classi -----------------------------------------------------------------------------

export function saveCourse(course: Omit<Course, 'updatedAt'>): Change {
  return (data) => put(data, 'courses', course.id, { ...course, updatedAt: 0 })
}

/**
 * Un nuovo orario da una data in poi (ADR 0010). Prima di quella data resta l'orario di
 * prima, così le lezioni passate non cambiano giorno. Il piano da quella data passa sulle
 * nuove lezioni nello stesso ordine: la prima lezione col nuovo orario fa quello che faceva
 * la prima col vecchio, e così via. Le lezioni annullate restano nel loro giorno, se c'è
 * ancora. Una data all'inizio dell'anno, o prima, corregge l'orario per tutto l'anno.
 */
export function changeSchedule(courseId: string, schedule: ScheduleSlot[], from: ISODate): Change {
  return (data) => {
    const course = data.courses[courseId]
    if (!course || !data.year) return data

    let pastSchedules: PastSchedule[] = []
    if (from > data.year.start) {
      const until = addDays(from, -1)
      pastSchedules = [...course.pastSchedules.filter((p) => p.until < until), { until, schedule: scheduleAt(course, until) }]
    }
    // Due orari uguali di seguito sono uno solo.
    pastSchedules = pastSchedules.filter((p, i) => !sameSchedule(p.schedule, pastSchedules[i + 1]?.schedule ?? schedule))
    const updated = { ...course, schedule, pastSchedules }

    const before = courseSlots(data, course, from)
    let next = put(data, 'courses', courseId, updated)
    const after = courseSlots(next, updated, from)

    const cancelled = new Map(before.filter((s) => s.lesson?.cancelled).map((s) => [s.date, s.lesson!]))
    const moving = before.filter((s) => !s.lesson?.cancelled).map((s) => s.lesson)
    const target = new Map<ISODate, Lesson>()
    let i = 0
    for (const slot of after) {
      const lesson = cancelled.get(slot.date) ?? moving[i++]
      if (lesson) target.set(slot.date, lesson.date === slot.date ? lesson : { ...lesson, date: slot.date })
    }
    // Con meno lezioni di prima, quello che esce dall'anno finisce nell'ultima, per non perderlo.
    const left = moving.slice(i).flatMap((l) => l?.activities ?? [])
    const last = after.filter((s) => !target.get(s.date)?.cancelled).at(-1)
    if (left.length > 0 && last) {
      const lesson = target.get(last.date) ?? emptyLesson(courseId, last.date)
      target.set(last.date, { ...lesson, activities: [...lesson.activities, ...left] })
    }

    const stale = Object.keys(next.lessons).filter((k) => {
      const l = next.lessons[k]
      return l.courseId === courseId && l.date >= from && !target.has(l.date)
    })
    next = remove(next, 'lessons', stale)
    for (const lesson of target.values()) if (next.lessons[lessonKey(courseId, lesson.date)] !== lesson) next = writeLesson(next, lesson)
    return next
  }
}

export function deleteCourse(courseId: string): Change {
  return (data) => {
    let next = remove(data, 'courses', [courseId])
    next = remove(next, 'topics', Object.keys(data.topics).filter((k) => data.topics[k].courseId === courseId))
    return remove(next, 'lessons', Object.keys(data.lessons).filter((k) => data.lessons[k].courseId === courseId))
  }
}

// --- Programma --------------------------------------------------------------------------

export function saveTopic(topic: Omit<Topic, 'updatedAt'>): Change {
  return (data) => put(data, 'topics', topic.id, { ...topic, updatedAt: 0 })
}

export function saveTopics(topics: Omit<Topic, 'updatedAt'>[]): Change {
  return (data) => topics.reduce((d, t) => saveTopic(t)(d), data)
}

/** Argomento concluso a mano, senza lezioni in calendario (es. svolto prima di usare ProfClick). */
export function setTopicCompleted(topicId: string, completed: boolean): Change {
  return (data) => {
    const topic = data.topics[topicId]
    return topic ? put(data, 'topics', topicId, { ...topic, completed }) : data
  }
}

/** Valutazione prevista segnata come fatta, senza metterla in calendario. */
export function setAssessmentDone(topicId: string, assessmentId: string, done: boolean): Change {
  return (data) => {
    const topic = data.topics[topicId]
    if (!topic) return data
    return put(data, 'topics', topicId, { ...topic, assessments: topic.assessments.map((a) => (a.id === assessmentId ? { ...a, done } : a)) })
  }
}

export function deleteTopic(topicId: string): Change {
  return (data) => remove(data, 'topics', [topicId])
}

/** Sposta un argomento di un posto in su o in giù, rinumerando l'ordine della classe. */
export function moveTopic(topicId: string, direction: -1 | 1): Change {
  return (data) => {
    const topic = data.topics[topicId]
    if (!topic) return data
    const list = Object.values(data.topics)
      .filter((t) => t.courseId === topic.courseId)
      .sort((a, b) => a.order - b.order)
    const from = list.findIndex((t) => t.id === topicId)
    const to = from + direction
    if (to < 0 || to >= list.length) return data
    ;[list[from], list[to]] = [list[to], list[from]]
    return list.reduce((d, t, i) => (t.order === i ? d : put(d, 'topics', t.id, { ...t, order: i })), data)
  }
}

// --- Lezioni ----------------------------------------------------------------------------

function emptyLesson(courseId: string, date: ISODate): Lesson {
  return { courseId, date, activities: [], done: false, cancelled: false, note: '', updatedAt: 0 }
}

function isBlank(lesson: Lesson): boolean {
  return lesson.activities.length === 0 && !lesson.done && !lesson.cancelled && !lesson.note.trim()
}

/** Scrive il piano di un giorno; se resta vuoto lo toglie, così il file non si riempie di niente. */
function writeLesson(data: ProfclickData, lesson: Lesson): ProfclickData {
  const key = lessonKey(lesson.courseId, lesson.date)
  if (isBlank(lesson)) return data.lessons[key] ? remove(data, 'lessons', [key]) : data
  return put(data, 'lessons', key, lesson)
}

export function updateLesson(courseId: string, date: ISODate, update: (lesson: Lesson) => Lesson): Change {
  return (data) => writeLesson(data, update(data.lessons[lessonKey(courseId, date)] ?? emptyLesson(courseId, date)))
}

export function addActivity(courseId: string, date: ISODate, activity: Activity): Change {
  return updateLesson(courseId, date, (l) => ({ ...l, activities: [...l.activities, activity] }))
}

export function replaceActivity(courseId: string, date: ISODate, activity: Activity): Change {
  return updateLesson(courseId, date, (l) => ({ ...l, activities: l.activities.map((a) => (a.id === activity.id ? activity : a)) }))
}

export function removeActivity(courseId: string, date: ISODate, activityId: string): Change {
  return updateLesson(courseId, date, (l) => ({ ...l, activities: l.activities.filter((a) => a.id !== activityId) }))
}

export function setDone(courseId: string, date: ISODate, done: boolean): Change {
  return updateLesson(courseId, date, (l) => ({ ...l, done }))
}

export function setNote(courseId: string, date: ISODate, note: string): Change {
  return updateLesson(courseId, date, (l) => ({ ...l, note }))
}

/** Segna fatte in un colpo tutte le lezioni passate con qualcosa in programma. */
export function markDone(slots: { courseId: string; date: ISODate }[]): Change {
  return (data) => slots.reduce((d, s) => setDone(s.courseId, s.date, true)(d), data)
}

/**
 * Lezione persa (gita, assemblea, sciopero): il giorno si segna annullato e quello che
 * c'era in programma slitta, con tutto il resto del piano, alla lezione successiva.
 * Le lezioni già fatte non si toccano.
 */
export function cancelAndShift(courseId: string, date: ISODate): Change {
  return (data) => {
    const course = data.courses[courseId]
    if (!course) return data
    const slots = courseSlots(data, course, date).filter((s) => s.date === date || (isAvailable(s) && !s.lesson?.done))
    if (slots[0]?.date !== date) return data

    let carry = slots[0].lesson?.activities ?? []
    let next = updateLesson(courseId, date, (l) => ({ ...l, activities: [], cancelled: true, done: false }))(data)
    for (const slot of slots.slice(1)) {
      if (carry.length === 0) break
      const moving = carry
      carry = slot.lesson?.activities ?? []
      next = updateLesson(courseId, slot.date, (l) => ({ ...l, activities: moving }))(next)
    }
    // Quello che esce dall'anno scolastico finisce nell'ultima lezione, per non perderlo.
    if (carry.length > 0 && slots.length > 1) {
      const last = slots.at(-1)!.date
      next = updateLesson(courseId, last, (l) => ({ ...l, activities: [...l.activities, ...carry] }))(next)
    }
    return next
  }
}

/** Annulla solo il giorno, senza spostare niente (es. il piano era già vuoto). */
export function setCancelled(courseId: string, date: ISODate, cancelled: boolean): Change {
  return updateLesson(courseId, date, (l) => ({ ...l, cancelled, done: cancelled ? false : l.done }))
}

export function applyProposal(courseId: string, lessons: ProposedLesson[], newId: () => string): Change {
  return (data) => lessons.reduce((d, p) => addActivity(courseId, p.date, { ...p.activity, id: newId() })(d), data)
}

/**
 * Per "Annulla": i record cambiati da allora tornano com'erano. Ricevono un updatedAt nuovo,
 * così l'annullamento vince anche sugli altri dispositivi che hanno già la modifica.
 */
export function undoTo(before: ProfclickData): Change {
  return (current) => {
    let next = current
    for (const collection of ['courses', 'topics', 'lessons'] as const) {
      const was = before[collection] as Record<string, Stamped>
      const is = current[collection] as Record<string, Stamped>
      for (const key of new Set([...Object.keys(was), ...Object.keys(is)])) {
        if (was[key] === is[key]) continue
        next = was[key] ? put(next, collection, key, was[key] as never) : remove(next, collection, [key])
      }
    }
    if (before.year && before.year !== current.year) next = setYear(before.year)(next)
    return next
  }
}

// --- Da preparare -----------------------------------------------------------------------

export function togglePrep(courseId: string, itemId: string): Change {
  return (data) => {
    const course = data.courses[courseId]
    if (!course) return data
    return put(data, 'courses', courseId, { ...course, prep: course.prep.map((p) => (p.id === itemId ? { ...p, done: !p.done } : p)) })
  }
}
