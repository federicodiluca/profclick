// Funzioni di presentazione condivise dai componenti.

import type { CSSProperties } from 'react'
import { type Activity, type Course, GRADE_LABELS, type GradeType, isMinor } from '@/core/model'

export const COURSE_COLORS = 8

export function courseColor(course: Pick<Course, 'color'>): string {
  return `var(--course-${course.color % COURSE_COLORS})`
}

/**
 * Le cose di una classe (lezioni, schede, righe) portano il suo colore: una striscia a sinistra
 * e, se c'è un fondo, appena tinto. Quanto tinto lo decide il tema (--course-tint).
 */
export function courseSurface(course: Pick<Course, 'color'>, { tint = true }: { tint?: boolean } = {}): CSSProperties {
  const color = courseColor(course)
  return {
    boxShadow: `inset 4px 0 0 ${color}`,
    ...(tint && { background: `color-mix(in oklab, ${color} var(--course-tint), var(--card))` }),
  }
}

/** Le valutazioni in rosso, il resto in blu: come la matita del docente. */
export function activityTone(activity: Activity): string {
  return activity.kind === 'verifica' ? 'text-pencil-red' : 'text-pencil-blue'
}

/**
 * Una lezione in cui si mette un voto: contorno rosso e icona del tipo di prova. Più marcato
 * per un orale o un pratico (voto pieno), più leggero per lo scritto o un voto minore.
 */
export interface GradeMark {
  type: GradeType
  strong: boolean
  /** "Orale", "Pratico", "Scritto 50%". */
  label: string
  /** Contorno della scheda. */
  border: string
}

export function gradeMark(activities: Activity[]): GradeMark | null {
  const graded = activities.flatMap((a) => (a.kind === 'verifica' && a.assessment ? [a.assessment] : []))
  if (graded.length === 0) return null
  // Se ce n'è più d'una, vale la più impegnativa.
  const pick = graded.find((a) => a.type !== 'scritto' && !isMinor(a)) ?? graded.find((a) => !isMinor(a)) ?? graded[0]
  const strong = pick.type !== 'scritto' && !isMinor(pick)
  return {
    type: pick.type,
    strong,
    label: isMinor(pick) ? `${GRADE_LABELS[pick.type]} ${pick.weight}%` : GRADE_LABELS[pick.type],
    border: strong ? 'border-2 border-pencil-red' : 'border-pencil-red/50',
  }
}

export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10
  return `${String(rounded).replace('.', ',')} ${rounded === 1 ? 'ora' : 'ore'}`
}

/** I voti di un periodo, con le stesse parole ovunque: "2 fatti, 4 in calendario su 5". */
export function gradesLine(grades: { done: number; full: unknown[]; target: number }): string {
  return `${grades.done} ${grades.done === 1 ? 'fatto' : 'fatti'}, ${grades.full.length} in calendario su ${grades.target}`
}
