// Funzioni di presentazione condivise dai componenti.

import type { Activity, Course } from '@/core/model'

export const COURSE_COLORS = 8

export function courseColor(course: Pick<Course, 'color'>): string {
  return `var(--course-${course.color % COURSE_COLORS})`
}

/** Le valutazioni in rosso, il resto in blu: come la matita del docente. */
export function activityTone(activity: Activity): string {
  return activity.kind === 'verifica' ? 'text-pencil-red' : 'text-pencil-blue'
}

export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10
  return `${String(rounded).replace('.', ',')} ${rounded === 1 ? 'ora' : 'ore'}`
}

/** I voti di un periodo, con le stesse parole ovunque: "2 fatti, 4 in calendario su 5". */
export function gradesLine(grades: { done: number; full: unknown[]; target: number }): string {
  return `${grades.done} ${grades.done === 1 ? 'fatto' : 'fatti'}, ${grades.full.length} in calendario su ${grades.target}`
}
