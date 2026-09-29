// Le valutazioni sul calendario (ADR 0009), senza chiedere permessi su Google Calendar:
// un collegamento che apre Calendar con l'evento già compilato, oppure un file .ics con
// tutte le valutazioni dell'anno da importare in qualsiasi calendario.

import { courseSlots, sortedCourses } from './calendar'
import { addDays, type ISODate } from './dates'
import { activityLabel, type Activity, type Course, courseLabel, type ProfclickData } from './model'

export interface CalendarEntry {
  uid: string
  date: ISODate
  title: string
  details: string
}

function compact(date: ISODate): string {
  return date.replaceAll('-', '')
}

export function assessmentEntry(data: ProfclickData, course: Course, date: ISODate, activity: Activity): CalendarEntry {
  const topics = activity.topicIds.map((id) => data.topics[id]?.title).filter(Boolean)
  return {
    uid: `${activity.id}@profclick.federicodiluca.com`,
    date,
    title: `${activityLabel(activity)} ${course.className}${topics.length ? `: ${topics.join(', ')}` : ''}`,
    details: [courseLabel(course), activity.text].filter(Boolean).join(' · '),
  }
}

/** Apre Google Calendar con un evento di un giorno intero già compilato. */
export function googleCalendarLink(entry: CalendarEntry): string {
  const url = new URL('https://calendar.google.com/calendar/render')
  url.searchParams.set('action', 'TEMPLATE')
  url.searchParams.set('text', entry.title)
  url.searchParams.set('dates', `${compact(entry.date)}/${compact(addDays(entry.date, 1))}`)
  if (entry.details) url.searchParams.set('details', entry.details)
  return url.toString()
}

export function allAssessments(data: ProfclickData): CalendarEntry[] {
  return sortedCourses(data).flatMap((course) =>
    courseSlots(data, course).flatMap((slot) =>
      (slot.lesson?.cancelled ? [] : (slot.lesson?.activities ?? []))
        .filter((a) => a.kind === 'verifica' && a.assessment && !a.assessment.continues)
        .map((a) => assessmentEntry(data, course, slot.date, a)),
    ),
  )
}

function escape(text: string): string {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
}

/**
 * Il file .ics. Ogni evento ha un UID stabile: importandolo di nuovo, i calendari
 * aggiornano gli eventi invece di duplicarli.
 */
export function toIcs(entries: CalendarEntry[], stamp: Date): string {
  const now = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ProfClick//IT', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Verifiche ProfClick']
  for (const e of entries) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${compact(e.date)}`,
      `DTEND;VALUE=DATE:${compact(addDays(e.date, 1))}`,
      `SUMMARY:${escape(e.title)}`,
      ...(e.details ? [`DESCRIPTION:${escape(e.details)}`] : []),
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
