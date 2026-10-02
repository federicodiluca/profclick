// L'orario settimanale di tutte le classi in una griglia giorni × ore di scuola, da stampare
// o tenere sul telefono. Si ricava dall'orario in vigore nel giorno indicato: con l'ora
// d'inizio una lezione va nella sua riga, senza resta nel giorno, in ordine; le lezioni
// senza giorno fisso (ADR 0008) si elencano a parte.

import { sortedCourses } from './calendar'
import type { ISODate } from './dates'
import { type Course, type ProfclickData, scheduleAt } from './model'

export interface TimetableEntry {
  course: Course
  hours: number
  lab: boolean
}

export interface Timetable {
  /** I giorni con almeno una lezione, da lunedì (1) a sabato (6); sempre da lunedì a venerdì. */
  days: number[]
  /** Quante ore di scuola mostrare: fino all'ultima occupata. */
  rows: number
  /** Per giorno e ora di scuola, la lezione che inizia lì. */
  cells: Map<string, TimetableEntry>
  /** Per giorno, le lezioni senza ora d'inizio, in ordine. */
  unplaced: Map<number, TimetableEntry[]>
  /** Le lezioni senza giorno fisso, per classe. */
  floating: TimetableEntry[]
}

export function cellKey(day: number, hour: number): string {
  return `${day}-${hour}`
}

export function timetable(data: ProfclickData, date: ISODate): Timetable {
  const cells = new Map<string, TimetableEntry>()
  const unplaced = new Map<number, TimetableEntry[]>()
  const floating: TimetableEntry[] = []
  const occupied = new Set<string>()
  const days = new Set([1, 2, 3, 4, 5])
  let rows = 0
  for (const course of sortedCourses(data)) {
    for (const slot of scheduleAt(course, date)) {
      if (slot.hours <= 0) continue
      const entry = { course, hours: slot.hours, lab: slot.lab }
      if (slot.day === null) floating.push(entry)
      else if (slot.start) {
        days.add(slot.day)
        const span = Array.from({ length: Math.ceil(slot.hours) }, (_, i) => cellKey(slot.day!, slot.start! + i))
        // Due classi alla stessa ora (orario sbagliato o classi articolate): la seconda va tra quelle senza ora.
        if (span.some((key) => occupied.has(key))) unplaced.set(slot.day, [...(unplaced.get(slot.day) ?? []), entry])
        else {
          cells.set(span[0], entry)
          span.forEach((key) => occupied.add(key))
          rows = Math.max(rows, slot.start + span.length - 1)
        }
      } else {
        days.add(slot.day)
        unplaced.set(slot.day, [...(unplaced.get(slot.day) ?? []), entry])
      }
    }
  }
  return { days: [...days].sort(), rows, cells, unplaced, floating }
}
