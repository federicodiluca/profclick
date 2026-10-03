// Tutto quello da preparare, in un posto solo (ADR 0017). Ogni attività in programma porta
// con sé il suo materiale: due spiegazioni sono due cose da preparare, senza scriverle a mano.
// Si aggiungono le voci scritte nelle classi e quelle delle riunioni.

import { type Change, setActivityReady, toggleMeetingPrep, togglePrep } from './actions'
import { courseSlots, sortedCourses } from './calendar'
import type { ISODate } from './dates'
import { sortedMeetings } from './meetings'
import type { Activity, Course, Meeting, MeetingPrep, PrepItem, ProfclickData } from './model'
import { coursePrep } from './prep'

export type TodoSource =
  | { kind: 'activity'; course: Course; activity: Activity; floating: boolean; index: number; hours: number }
  | { kind: 'prep'; course: Course; item: PrepItem }
  | { kind: 'meeting'; meeting: Meeting; item: MeetingPrep }

export interface Todo {
  id: string
  /** Quando serve; null per una voce della classe con l'argomento non ancora in calendario. */
  due: ISODate | null
  done: boolean
  source: TodoSource
}

/**
 * Un'interrogazione, o la seconda parte di una valutazione già iniziata, non chiede
 * materiale: il resto sì, dalla spiegazione alla verifica scritta.
 */
export function needsPrep(activity: Activity): boolean {
  const a = activity.assessment
  return !a || (!a.continues && a.type !== 'teorico')
}

/**
 * Le cose da preparare per le lezioni e le riunioni da oggi fino a `until`, comprese quelle
 * già pronte (restano spuntate finché la lezione non passa), più le voci delle classi ancora
 * senza data. In ordine di scadenza; nello stesso giorno, nell'ordine delle classi.
 */
export function todos(data: ProfclickData, today: ISODate, until: ISODate): Todo[] {
  const result: Todo[] = []
  for (const course of sortedCourses(data)) {
    for (const slot of courseSlots(data, course, today, until)) {
      const lesson = slot.lesson
      // Una lezione fatta è passata: quello che serviva, è servito.
      if (!lesson || lesson.cancelled || lesson.done) continue
      for (const activity of lesson.activities.filter(needsPrep)) {
        result.push({
          id: activity.id,
          due: slot.date,
          done: Boolean(activity.ready),
          source: { kind: 'activity', course, activity, floating: slot.floating, index: slot.index, hours: slot.hours },
        })
      }
    }
  }
  for (const course of sortedCourses(data)) {
    for (const { item, due } of coursePrep(data, course, today)) {
      if (due ? due <= until : !item.done) result.push({ id: item.id, due, done: item.done, source: { kind: 'prep', course, item } })
    }
  }
  for (const meeting of sortedMeetings(data).filter((m) => m.date >= today && m.date <= until)) {
    for (const item of meeting.prep.filter((p) => p.text.trim())) {
      result.push({ id: item.id, due: meeting.date, done: item.done, source: { kind: 'meeting', meeting, item } })
    }
  }
  return result.sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
}

/** La classe a cui serve, se è una voce di classe: per il filtro delle classi. */
export function todoCourse(todo: Todo): Course | null {
  return todo.source.kind === 'meeting' ? null : todo.source.course
}

/** Pronto, o di nuovo da preparare: una voce cambia stato. */
export function toggleTodo(todo: Todo): Change {
  const s = todo.source
  if (s.kind === 'activity') return setActivityReady(s.course.id, todo.due!, s.activity.id, !todo.done)
  if (s.kind === 'prep') return togglePrep(s.course.id, s.item.id)
  return toggleMeetingPrep(s.meeting.id, s.item.id)
}

/** Tante voci insieme, tutte pronte o tutte da preparare: si toccano solo quelle da cambiare. */
export function setTodosDone(list: Todo[], done: boolean): Change {
  return (data) => list.filter((t) => t.done !== done).reduce((d, t) => toggleTodo(t)(d), data)
}
