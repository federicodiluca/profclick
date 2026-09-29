// Il materiale da preparare con la sua scadenza: la prima lezione, da oggi, in cui compare
// l'argomento a cui serve. È quello che una lista di Keep non può sapere.

import { courseSlots, sortedCourses } from './calendar'
import type { ISODate } from './dates'
import type { Course, PrepItem, ProfclickData } from './model'

export interface PrepDue {
  course: Course
  item: PrepItem
  /** Quando serve; null se l'argomento non è ancora in calendario (o manca). */
  due: ISODate | null
}

export function openPrep(data: ProfclickData, today: ISODate): PrepDue[] {
  const result: PrepDue[] = []
  for (const course of sortedCourses(data)) {
    const open = course.prep.filter((p) => !p.done && p.text.trim())
    if (open.length === 0) continue
    const slots = courseSlots(data, course, today).filter((s) => !s.lesson?.cancelled)
    for (const item of open) {
      const slot = item.topicId ? slots.find((s) => s.lesson?.activities.some((a) => a.topicIds.includes(item.topicId!))) : undefined
      result.push({ course, item, due: slot?.date ?? null })
    }
  }
  // Prima quello che serve prima; senza data in fondo, nell'ordine delle classi.
  return result.sort((a, b) => (a.due ?? '9999') .localeCompare(b.due ?? '9999'))
}
