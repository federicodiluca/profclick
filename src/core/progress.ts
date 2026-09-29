// Avanzamento del programma: per ogni argomento, le ore messe in calendario e quelle
// già svolte. Le ore di una lezione si dividono in parti uguali tra le sue attività:
// è una stima, ma basta per capire se si è in ritardo.

import { courseSlots, isAvailable } from './calendar'
import type { ISODate } from './dates'
import type { ActivityKind, Course, ProfclickData, Topic } from './model'

/** Le attività che fanno avanzare il programma. */
export const TEACHING_KINDS: ActivityKind[] = ['spiegazione', 'esercitazione', 'laboratorio', 'ripasso']

export interface TopicProgress {
  topic: Topic
  plannedHours: number
  doneHours: number
  /** Prima e ultima lezione in cui compare. */
  firstDate?: ISODate
  lastDate?: ISODate
  status: 'da-pianificare' | 'pianificato' | 'in-corso' | 'fatto'
}

export function courseTopics(data: ProfclickData, courseId: string): Topic[] {
  return Object.values(data.topics)
    .filter((t) => t.courseId === courseId)
    .sort((a, b) => a.order - b.order)
}

export function topicProgress(data: ProfclickData, course: Course): TopicProgress[] {
  const byTopic = new Map<string, { planned: number; done: number; first?: ISODate; last?: ISODate }>()
  for (const slot of courseSlots(data, course)) {
    const lesson = slot.lesson
    if (!lesson || !isAvailable(slot) || lesson.activities.length === 0) continue
    const share = slot.hours / lesson.activities.length
    for (const activity of lesson.activities) {
      if (!TEACHING_KINDS.includes(activity.kind)) continue
      for (const id of activity.topicIds) {
        const entry = byTopic.get(id) ?? { planned: 0, done: 0 }
        const hours = share / activity.topicIds.length
        entry.planned += hours
        if (lesson.done) entry.done += hours
        entry.first ??= slot.date
        entry.last = slot.date
        byTopic.set(id, entry)
      }
    }
  }

  return courseTopics(data, course.id).map((topic) => {
    const entry = byTopic.get(topic.id)
    const plannedHours = entry?.planned ?? 0
    const doneHours = entry?.done ?? 0
    const status: TopicProgress['status'] =
      topic.completed || (plannedHours > 0 && doneHours >= Math.max(plannedHours, topic.hours) - 0.01)
        ? 'fatto'
        : doneHours > 0
          ? 'in-corso'
          : plannedHours > 0
            ? 'pianificato'
            : 'da-pianificare'
    return { topic, plannedHours, doneHours, firstDate: entry?.first, lastDate: entry?.last, status }
  })
}

/**
 * L'argomento su cui si sta lavorando a una data: quello dell'ultima lezione pianificata
 * prima, o il primo non concluso. Serve a precompilare le scelte.
 */
export function topicAround(data: ProfclickData, course: Course, date: ISODate): Topic | undefined {
  const slots = courseSlots(data, course, undefined, date).reverse()
  for (const slot of slots) {
    const activity = slot.lesson?.activities.find((a) => TEACHING_KINDS.includes(a.kind) && a.topicIds.length > 0)
    if (activity) return data.topics[activity.topicIds.at(-1)!]
  }
  return topicProgress(data, course).find((p) => p.status !== 'fatto')?.topic
}

/** Gli argomenti trattati dopo l'ultima valutazione piena: quelli da verificare. */
export function topicsSinceLastAssessment(data: ProfclickData, course: Course, date: ISODate): string[] {
  const slots = courseSlots(data, course, undefined, date).filter((s) => s.date < date)
  const ids: string[] = []
  for (const slot of slots.reverse()) {
    const activities = slot.lesson?.activities ?? []
    if (activities.some((a) => a.kind === 'verifica' && a.assessment && a.assessment.weight >= 100 && !a.assessment.continues)) break
    for (const a of activities) {
      if (TEACHING_KINDS.includes(a.kind)) for (const id of a.topicIds) if (!ids.includes(id)) ids.unshift(id)
    }
  }
  return ids
}
