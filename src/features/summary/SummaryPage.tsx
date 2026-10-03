import { createElement, useState } from 'react'
import { Link } from 'wouter'
import { CourseName, Segmented } from '@/components/bits'
import { NoteIcon } from '@/components/icons'
import { GRADE_ICONS } from '@/lib/activityIcons'
import { PencilTick, PencilUnderline, PencilWave } from '@/components/pencil'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { saveCourse } from '@/core/actions'
import { currentPeriod, periodSlots, schoolWeeks, sortedCourses } from '@/core/calendar'
import { formatRange, formatShort, startOfWeek, today } from '@/core/dates'
import { type NextGrade, nextGrades, type PeriodGrades, periodGrades, programAssessments } from '@/core/grading'
import { type Course, GRADE_LABELS, isMinor, type Period } from '@/core/model'
import { freeSlots } from '@/core/proposal'
import { formatHours } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { useAutosave } from '@/lib/useAutosave'
import { useData } from '@/state/data'

/**
 * A che punto è ogni classe nel periodo (ADR 0020): quante lezioni restano, i prossimi voti
 * da dare e quanto c'è ancora da pianificare. Una riga per classe, le note in un popup.
 */
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

      {period && <PeriodWeeks period={period} now={now} />}

      {courses.length === 0 ? (
        <p className="text-muted-foreground">Ancora nessuna classe: il riepilogo si riempie quando ne aggiungi una.</p>
      ) : (
        period && (
          <div className="space-y-3">
            {courses.map((course) => (
              <CourseSummary key={course.id} course={course} period={period} />
            ))}
          </div>
        )
      )}
    </div>
  )
}

/** Quante settimane di scuola sono passate: le vacanze non contano, come quando si pianifica. */
function PeriodWeeks({ period, now }: { period: Period; now: string }) {
  const { data } = useData()
  const weeks = schoolWeeks(data.year!, period)
  const passed = weeks.filter((w) => w < startOfWeek(now)).length
  const left = weeks.length - passed
  const text =
    now < period.start
      ? `Non è ancora iniziato: ${weeks.length} settimane di scuola`
      : now > period.end
        ? 'Concluso'
        : left === 1
          ? "Resta quest'ultima settimana di scuola"
          : `Restano ${left} settimane di scuola su ${weeks.length}`
  const pct = weeks.length ? Math.min(100, (passed / weeks.length) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{period.name}</span>
        <span>{text}</span>
      </div>
      <div className="relative h-2 rounded-full bg-muted" role="presentation">
        <div className="absolute inset-y-0 left-0 rounded-full bg-pencil-blue transition-all" style={{ width: `${now > period.end ? 100 : pct}%` }} />
      </div>
    </div>
  )
}

const STATUS: Record<PeriodGrades['status'], { label: string; tone: string }> = {
  ok: { label: 'In regola', tone: 'text-done' },
  'da-pianificare': { label: 'Da pianificare', tone: 'text-warn' },
  'a-rischio': { label: 'A rischio', tone: 'text-pencil-red' },
}

function CourseSummary({ course, period }: { course: Course; period: Period }) {
  const { data } = useData()
  const now = today()
  const [notesOpen, setNotesOpen] = useState(false)
  const grades = periodGrades(data, course, period, now)
  const status = STATUS[grades.status]
  const next = nextGrades(data, course, grades)
  const program = programAssessments(data, course, period, grades)
  const note = (course.periodNotes[period.id] ?? '').trim()

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
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

      <p className="text-sm text-muted-foreground">
        {grades.remainingLessons === 0 ? 'Nessuna lezione rimasta' : grades.remainingLessons === 1 ? 'Resta una lezione' : `Restano ${grades.remainingLessons} lezioni`}
        {grades.status !== 'ok' && <ToPlan course={course} period={period} />}
      </p>

      {next.length > 0 ? (
        <div className="space-y-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">{next.length === 1 ? 'Prossimo voto' : 'Prossimi voti'}</h3>
          <ul className="space-y-1">
            {next.map((g, i) => (
              <NextGradeLine key={i} grade={g} />
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nessun altro voto da dare in questo periodo.</p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
        <div className="space-y-0.5">
          {program.total > 0 && (
            <p>
              Dal programma {program.total === 1 ? 'una valutazione' : `${program.total} valutazioni`}:{' '}
              {program.unplaced === 0 ? (program.total === 1 ? 'già messa' : 'tutte già messe') : `${program.total - program.unplaced} già messe, ${program.unplaced} da mettere`}
            </p>
          )}
          <p>
            Voti {grades.done} {grades.done === 1 ? 'fatto' : 'fatti'} su {grades.target}
            {grades.civics.target > 0 && ` · Ed. civica ${formatHours(grades.civics.planned)} in calendario su ${formatHours(grades.civics.target)}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setNotesOpen(true)} className="max-w-full" aria-label={`Note di ${period.name} per ${course.className}`}>
          <NoteIcon />
          {note ? <span className="max-w-48 truncate">{note.split('\n')[0]}</span> : 'Note'}
        </Button>
      </div>

      <NotesDialog course={course} period={period} open={notesOpen} onClose={() => setNotesOpen(false)} />
    </section>
  )
}

/** "· pianificato fino al 14/11, ancora 6 settimane da pianificare" */
function ToPlan({ course, period }: { course: Course; period: Period }) {
  const { data } = useData()
  const now = today()
  const free = freeSlots(data, course, period, now)
  const weeks = new Set(free.map((s) => startOfWeek(s.date))).size
  if (weeks === 0) return null
  // Pianificato di seguito fino a una data: nessuna lezione già piena dopo la prima vuota.
  const planned = periodSlots(data, course, period).filter((s) => s.date >= now && s.lesson?.activities.length)
  const lastBefore = planned.filter((s) => s.date < free[0].date).at(-1)
  const contiguous = !planned.some((s) => s.date > free[0].date)
  const count = weeks === 1 ? 'una settimana' : `${weeks} settimane`
  if (contiguous && lastBefore) return <>, pianificato fino al {formatShort(lastBefore.date)}: ancora {count} da pianificare</>
  if (contiguous) return <>, {count} da pianificare</>
  return <>, {count} con lezioni ancora vuote</>
}

function NextGradeLine({ grade }: { grade: NextGrade }) {
  const label = isMinor(grade) ? `${GRADE_LABELS[grade.type]} ${grade.weight}%` : GRADE_LABELS[grade.type]
  const about = grade.source === 'minimo' ? 'per arrivare al minimo' : [grade.about, grade.text].filter(Boolean).join(' · ')
  return (
    <li className="flex items-start gap-2 text-sm">
      {createElement(GRADE_ICONS[grade.type], { className: 'mt-0.5 size-4 shrink-0 text-muted-foreground' })}
      <span className="min-w-0 flex-1">
        <span className="font-medium">{label}</span>
        {about && <span className="text-muted-foreground"> · {about}</span>}
      </span>
      <span className={cn('shrink-0 text-xs', grade.date ? 'text-muted-foreground' : 'font-medium text-warn')}>
        {grade.date ? `in calendario ${formatShort(grade.date)}` : 'da mettere'}
      </span>
    </li>
  )
}

/** Le note per lo scrutinio, per classe e periodo: si scrivono in un popup per non affollare la lista. */
function NotesDialog({ course, period, open, onClose }: { course: Course; period: Period; open: boolean; onClose: () => void }) {
  const { apply } = useData()
  const note = course.periodNotes[period.id] ?? ''
  const field = useAutosave((value) => value !== note && apply(saveCourse({ ...course, periodNotes: { ...course.periodNotes, [period.id]: value } })))
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Note · {course.className} · {period.name}
          </DialogTitle>
          <DialogDescription>Per lo scrutinio: recuperi, accordi, chi tenere d'occhio. Si salvano da sole.</DialogDescription>
        </DialogHeader>
        <Textarea key={`${course.id}${period.id}`} defaultValue={note} rows={8} autoFocus aria-label={`Note di ${period.name} per ${course.className}`} {...field} />
      </DialogContent>
    </Dialog>
  )
}
