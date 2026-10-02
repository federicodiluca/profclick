import { createElement, useState } from 'react'
import { Link } from 'wouter'
import { CourseName, Segmented } from '@/components/bits'
import { GRADE_ICONS } from '@/lib/activityIcons'
import { PencilTick, PencilUnderline, PencilWave } from '@/components/pencil'
import { Textarea } from '@/components/ui/textarea'
import { saveCourse } from '@/core/actions'
import { currentPeriod, isAvailable, periodSlots, sortedCourses } from '@/core/calendar'
import { daysBetween, formatRange, today } from '@/core/dates'
import { type PeriodGrades, periodGrades } from '@/core/grading'
import { type Course, GRADE_LABELS, isMinor, type Period } from '@/core/model'
import { topicProgress } from '@/core/progress'
import { formatHours, gradesLine } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { useAutosave } from '@/lib/useAutosave'
import { useData } from '@/state/data'

/** A che punto è ogni classe nel periodo: voti, programma, educazione civica, e due righe di note. */
export default function SummaryPage() {
  const { data } = useData()
  const now = today()
  const year = data.year!
  const [periodId, setPeriodId] = useState(() => currentPeriod(year, now)?.id ?? year.periods[0]?.id)
  const period = year.periods.find((p) => p.id === periodId) ?? year.periods[0]
  const courses = sortedCourses(data)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            <span className="relative text-foreground">
              Riepilogo
              {/* Il titolo sottolineato a matita blu, come in cima a una pagina di quaderno. */}
              <PencilUnderline className="text-pencil-blue" />
            </span>
          </h1>
          {period && <p className="mt-1 text-muted-foreground">{formatRange(period.start, period.end)}</p>}
        </div>
        {year.periods.length > 1 && (
          <Segmented value={period?.id ?? ''} options={year.periods.map((p) => ({ value: p.id, label: p.name }))} onChange={setPeriodId} />
        )}
      </div>

      {period && <PeriodTime period={period} now={now} />}

      {courses.length === 0 ? (
        <p className="text-muted-foreground">Ancora nessuna classe: il riepilogo si riempie quando ne aggiungi una.</p>
      ) : (
        period && (
          <div className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <CourseSummary key={course.id} course={course} period={period} />
            ))}
          </div>
        )
      )}
    </div>
  )
}

/** Quanto del periodo è passato: il metro con cui leggere le barre delle classi. */
function PeriodTime({ period, now }: { period: Period; now: string }) {
  const total = daysBetween(period.start, period.end) + 1
  const passed = Math.min(total, Math.max(0, daysBetween(period.start, now) + 1))
  const left = total - passed
  const text = passed === 0 ? 'Non è ancora iniziato' : left === 0 ? 'Concluso' : `Passato il ${Math.round((passed / total) * 100)}%, mancano ${left} giorni`
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{period.name}</span>
        <span>{text}</span>
      </div>
      <Bar done={passed} max={total} tone="bg-pencil-blue" />
    </div>
  )
}

const STATUS: Record<PeriodGrades['status'], { label: string; tone: string }> = {
  ok: { label: 'In regola', tone: 'text-done' },
  'da-pianificare': { label: 'Da pianificare', tone: 'text-warn' },
  'a-rischio': { label: 'A rischio', tone: 'text-pencil-red' },
}

function CourseSummary({ course, period }: { course: Course; period: Period }) {
  const { data, apply } = useData()
  const now = today()
  const grades = periodGrades(data, course, period, now)
  const status = STATUS[grades.status]

  // Il programma del periodo in ore: fatte, in calendario, previste.
  const program = { total: 0, done: 0, planned: 0 }
  for (const p of topicProgress(data, course).filter((p) => p.topic.periodId === period.id)) {
    const hours = p.topic.hours
    const fatto = p.status === 'fatto'
    program.total += hours
    program.done += fatto ? hours : Math.min(p.doneHours, hours)
    program.planned += fatto ? hours : Math.min(Math.max(p.plannedHours, p.doneHours), hours)
  }
  // Dove si dovrebbe essere: la quota di lezioni del periodo già passate.
  const slots = periodSlots(data, course, period).filter(isAvailable)
  const pace = slots.length ? slots.filter((s) => s.date < now).length / slots.length : 0

  const unplacedFull = grades.unplaced.filter((u) => !isMinor(u.planned)).length
  const note = course.periodNotes[period.id] ?? ''
  const noteField = useAutosave((value) => value !== note && apply(saveCourse({ ...course, periodNotes: { ...course.periodNotes, [period.id]: value } })))

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <Link to={`/classi/${course.id}`} className="min-w-0 font-semibold hover:underline">
          <CourseName course={course} />
        </Link>
        <span className={cn('relative shrink-0 text-xs font-semibold', status.tone)}>
          {status.label}
          {grades.status === 'ok' && <PencilTick className="absolute -top-2.5 -right-5 size-5 text-pencil-blue" />}
          {grades.status === 'a-rischio' && <PencilWave />}
        </span>
      </div>

      <div className="space-y-3">
        <Meter label="Voti" detail={gradesLine(grades)} done={grades.done} planned={grades.full.length} max={grades.target} />
        {program.total > 0 && (
          <Meter
            label="Programma"
            detail={`${formatHours(program.done)} svolte, ${formatHours(program.planned)} in calendario su ${formatHours(program.total)}`}
            done={program.done}
            planned={program.planned}
            max={program.total}
            pace={pace}
          />
        )}
        {grades.civics.target > 0 && (
          <Meter
            label="Educazione civica"
            detail={`${formatHours(grades.civics.done)} svolte, ${formatHours(grades.civics.planned)} in calendario su ${formatHours(grades.civics.target)}`}
            done={grades.civics.done}
            planned={grades.civics.planned}
            max={grades.civics.target}
          />
        )}
      </div>

      {grades.status !== 'ok' && (
        <div className="space-y-1.5 text-sm">
          {grades.missingTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {grades.missingTypes.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-pencil-red/40 px-2 py-0.5 text-xs font-medium text-pencil-red">
                  {createElement(GRADE_ICONS[t], { className: 'size-3.5' })}
                  Manca {GRADE_LABELS[t].toLowerCase()}
                </span>
              ))}
            </div>
          )}
          <p className="text-muted-foreground">
            {grades.missing > 0 && `${grades.missing === 1 ? 'Un voto' : `${grades.missing} voti`} da mettere in calendario`}
            {grades.missing > 0 && unplacedFull > 0 && ` (${unplacedFull} già previsti nel programma)`}
            {grades.missing > 0 && ', '}
            {grades.freeLessons === 1 ? 'una lezione ancora libera' : `${grades.freeLessons} lezioni ancora libere`}.{' '}
            <Link to={`/classi/${course.id}`} className="font-medium text-primary hover:underline">
              Apri il piano
            </Link>
          </p>
        </div>
      )}

      <Textarea
        key={`${course.id}${period.id}`}
        defaultValue={note}
        rows={2}
        placeholder="Note per lo scrutinio: recuperi, accordi, chi tenere d'occhio…"
        aria-label={`Note di ${period.name} per ${course.className}`}
        className="min-h-0 text-sm"
        {...noteField}
      />
    </section>
  )
}

/** Una barra con il fatto pieno, il previsto più chiaro e, se c'è, il segno di dove si dovrebbe essere. */
function Meter({ label, detail, done, planned, max, pace }: { label: string; detail: string; done: number; planned: number; max: number; pace?: number }) {
  const behind = pace !== undefined && max > 0 && done / max < pace - 0.1
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-3 text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-right text-muted-foreground">{detail}</span>
      </div>
      <Bar done={done} planned={planned} max={max} pace={pace} />
      {behind && <p className="text-xs text-warn">Un po' indietro rispetto alle lezioni già passate.</p>}
    </div>
  )
}

function Bar({ done, planned = 0, max, pace, tone = 'bg-done' }: { done: number; planned?: number; max: number; pace?: number; tone?: string }) {
  const pct = (v: number) => (max > 0 ? Math.min(100, (v / max) * 100) : 0)
  return (
    <div className="relative h-2 rounded-full bg-muted" role="presentation">
      <div className={cn('absolute inset-y-0 left-0 rounded-full opacity-35', tone)} style={{ width: `${pct(Math.max(planned, done))}%` }} />
      <div className={cn('absolute inset-y-0 left-0 rounded-full transition-all', tone)} style={{ width: `${pct(done)}%` }} />
      {pace !== undefined && pace > 0 && pace < 1 && (
        <div className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground/50" style={{ left: `${pace * 100}%` }} title="Dove si dovrebbe essere" />
      )}
    </div>
  )
}
