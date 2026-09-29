// Il modello dei dati (ADR 0004). Tutto sta in un solo documento JSON, salvato sul
// dispositivo e sul Drive dell'utente. Ogni record porta updatedAt: quando due dispositivi
// hanno modificato i dati, l'unione (merge.ts) tiene per ogni record la versione più recente.

import type { ISODate } from './dates'

export interface Stamped {
  /** Millisecondi dell'ultima modifica: decide quale versione vince nell'unione. */
  updatedAt: number
}

// --- Anno scolastico --------------------------------------------------------------------

export interface Period {
  id: string
  /** "1° quadrimestre", "Trimestre", … */
  name: string
  start: ISODate
  end: ISODate
}

/** Giorni senza lezione: festività, vacanze, ponti, santo patrono. */
export interface Holiday {
  id: string
  name: string
  from: ISODate
  to: ISODate
}

export interface SchoolYear extends Stamped {
  /** "2026/27" */
  label: string
  start: ISODate
  end: ISODate
  periods: Period[]
  holidays: Holiday[]
}

// --- Classi -----------------------------------------------------------------------------

/** I tre tipi di voto (ADR 0005). */
export type GradeType = 'scritto' | 'teorico' | 'pratico'

export const GRADE_TYPES: GradeType[] = ['scritto', 'teorico', 'pratico']

export interface GradeRules {
  /** Voti pieni per periodo; null = automatico, uno per ogni ora settimanale. */
  perPeriod: number | null
  /** Tipi che devono comparire almeno una volta per periodo. */
  required: GradeType[]
  /** Peso proposto per i voti minori, in percentuale di un voto pieno. */
  minorWeight: number
}

/**
 * Una lezione della settimana tipo. Il giorno è facoltativo (ADR 0008): a chi non vuole
 * configurare l'orario basta dire quante lezioni ha e di quante ore, in ordine.
 */
export interface ScheduleSlot {
  /** 1 = lunedì … 6 = sabato; null = giorno non indicato. */
  day: number | null
  hours: number
  /** In laboratorio o in compresenza con l'ITP: il posto giusto per le prove pratiche. */
  lab: boolean
}

/** Qualcosa da preparare: slide, esercizi, un laboratorio. */
export interface PrepItem {
  id: string
  text: string
  /** L'argomento per cui serve: da lì si sa entro quando. */
  topicId: string | null
  done: boolean
}

/** Una classe con la sua materia: "3J · TPSIT". */
export interface Course extends Stamped {
  id: string
  className: string
  subject: string
  /** Indice nella tavolozza dei colori delle classi. */
  color: number
  schedule: ScheduleSlot[]
  rules: GradeRules
  /** Ore di educazione civica da svolgere, per periodo. */
  civics: Record<string, number>
  prep: PrepItem[]
  /** Appunti liberi sulla classe: quello che prima stava nelle note sparse. */
  notes: string
  order: number
}

/** Una valutazione prevista per un argomento, prima di avere una data. */
export interface PlannedAssessment {
  id: string
  type: GradeType
  /** Percentuale di un voto pieno: 100 = voto pieno, meno = voto minore. */
  weight: number
  /** "con orale", "prova parallela", "flipped classroom"… */
  text: string
}

/** Un macro-argomento del programma. */
export interface Topic extends Stamped {
  id: string
  courseId: string
  title: string
  /** Ore stimate per svolgerlo; 0 per una voce che è solo una valutazione (es. prova parallela). */
  hours: number
  /** Il periodo in cui va svolto; null = non ancora deciso. */
  periodId: string | null
  /** Sotto-punti, come promemoria: non si pianificano uno per uno. */
  points: string[]
  /** Le valutazioni da fare alla fine dell'argomento, nell'ordine. */
  assessments: PlannedAssessment[]
  /** Segnato come concluso a mano (es. svolto prima di usare ProfClick). */
  completed: boolean
  order: number
}

// --- Lezioni ----------------------------------------------------------------------------

export type ActivityKind = 'spiegazione' | 'esercitazione' | 'laboratorio' | 'ripasso' | 'verifica' | 'civica' | 'altro'

export interface Assessment {
  type: GradeType
  /** Percentuale di un voto pieno: sotto 100 è un voto minore, che non conta nel minimo. */
  weight: number
  /** Prosegue una valutazione iniziata in una lezione precedente (es. il giro di interrogazioni). */
  continues: boolean
  /** La valutazione prevista nel programma da cui nasce, se c'è. */
  plannedId?: string
}

export interface Activity {
  id: string
  kind: ActivityKind
  topicIds: string[]
  /** Dettaglio libero: "esercizi pag. 42", "gruppo B". */
  text: string
  /** Presente solo per kind = 'verifica'. */
  assessment?: Assessment
}

/**
 * Quello che si fa in un giorno di lezione di una classe. Esiste solo per i giorni in cui
 * c'è qualcosa: i giorni di lezione si ricavano dall'orario (calendar.ts).
 */
export interface Lesson extends Stamped {
  courseId: string
  date: ISODate
  activities: Activity[]
  done: boolean
  /** Lezione saltata (gita, assemblea, sciopero): non conta tra quelle disponibili. */
  cancelled: boolean
  note: string
}

export function lessonKey(courseId: string, date: ISODate): string {
  return `${courseId}@${date}`
}

export function isMinor(a: { weight: number }): boolean {
  return a.weight < 100
}

// --- Il documento -----------------------------------------------------------------------

export interface ProfclickData {
  schema: 1
  year: SchoolYear | null
  courses: Record<string, Course>
  topics: Record<string, Topic>
  lessons: Record<string, Lesson>
  /**
   * Record cancellati, come "collezione:chiave" → quando. Servono all'unione: senza, un
   * record cancellato qui tornerebbe dall'altro dispositivo che lo ha ancora.
   */
  deleted: Record<string, number>
}

export type Collection = 'courses' | 'topics' | 'lessons'

export function emptyData(): ProfclickData {
  return { schema: 1, year: null, courses: {}, topics: {}, lessons: {}, deleted: {} }
}

// --- Lettura tollerante -----------------------------------------------------------------

type Loose<T> = Partial<T> & Record<string, unknown>

/** L'orario delle prime versioni era un oggetto giorno → ore. */
function normalizeSchedule(raw: unknown): ScheduleSlot[] {
  if (Array.isArray(raw)) return raw.map((s: Loose<ScheduleSlot>) => ({ day: s.day ?? null, hours: Number(s.hours) || 0, lab: Boolean(s.lab) }))
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, number>)
      .filter(([, h]) => h)
      .map(([day, hours]) => ({ day: Number(day), hours, lab: false }))
  }
  return []
}

function normalizeCourse(c: Loose<Course>): Course {
  return {
    ...(c as Course),
    schedule: normalizeSchedule(c.schedule),
    civics: c.civics ?? {},
    prep: c.prep ?? [],
    notes: c.notes ?? '',
  }
}

function normalizeTopic(t: Loose<Topic>): Topic {
  return { ...(t as Topic), points: t.points ?? [], assessments: t.assessments ?? [] }
}

/** Le prime versioni avevano minor: boolean al posto del peso. */
function normalizeAssessment(a: Loose<Assessment> & { minor?: boolean }): Assessment {
  const { minor, ...rest } = a
  return { ...(rest as Assessment), weight: a.weight ?? (minor ? 50 : 100), continues: a.continues ?? false }
}

function normalizeLesson(l: Loose<Lesson>): Lesson {
  return {
    ...(l as Lesson),
    activities: (l.activities ?? []).map((a) => (a.assessment ? { ...a, assessment: normalizeAssessment(a.assessment as Loose<Assessment>) } : a)),
  }
}

function mapValues<T, U>(record: Record<string, T> | undefined, fn: (value: T) => U): Record<string, U> {
  return Object.fromEntries(Object.entries(record ?? {}).map(([k, v]) => [k, fn(v)]))
}

/** Legge un documento salvato, tollerando campi mancanti di versioni precedenti. */
export function normalizeData(raw: unknown): ProfclickData {
  const value = (raw ?? {}) as Partial<ProfclickData>
  return {
    schema: 1,
    year: value.year ?? null,
    courses: mapValues(value.courses as Record<string, Loose<Course>>, normalizeCourse),
    topics: mapValues(value.topics as Record<string, Loose<Topic>>, normalizeTopic),
    lessons: mapValues(value.lessons as Record<string, Loose<Lesson>>, normalizeLesson),
    deleted: value.deleted ?? {},
  }
}

export function isEmptyData(data: ProfclickData): boolean {
  return !data.year && Object.keys(data.courses).length === 0 && Object.keys(data.deleted).length === 0
}

// --- Etichette --------------------------------------------------------------------------

export const GRADE_LABELS: Record<GradeType, string> = {
  scritto: 'Scritto',
  teorico: 'Orale',
  pratico: 'Pratico',
}

const ASSESSMENT_LABELS: Record<GradeType, string> = {
  scritto: 'Verifica scritta',
  teorico: 'Interrogazione',
  pratico: 'Prova pratica',
}

export const KIND_LABELS: Record<ActivityKind, string> = {
  spiegazione: 'Spiegazione',
  esercitazione: 'Esercitazione',
  laboratorio: 'Laboratorio',
  ripasso: 'Ripasso',
  verifica: 'Valutazione',
  civica: 'Educazione civica',
  altro: 'Altro',
}

export function assessmentLabel(a: { type: GradeType; weight: number }): string {
  return isMinor(a) ? `${GRADE_LABELS[a.type]} ${a.weight}%` : ASSESSMENT_LABELS[a.type]
}

export function activityLabel(activity: Activity): string {
  const a = activity.assessment
  if (activity.kind !== 'verifica' || !a) return KIND_LABELS[activity.kind]
  return a.continues ? `${assessmentLabel(a)} (continua)` : assessmentLabel(a)
}

export function courseLabel(course: Course): string {
  return course.subject ? `${course.className} · ${course.subject}` : course.className
}

export function weeklyHours(course: Course): number {
  return course.schedule.reduce((sum, s) => sum + s.hours, 0)
}
