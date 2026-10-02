import { type ReactNode, useState } from 'react'
import { Link } from 'wouter'
import { ActivityLine, CourseName } from '@/components/bits'
import { formatHours } from '@/lib/ui'
import { AlertIcon, CancelledIcon, ChevronLeftIcon, ChevronRightIcon, DoneIcon, MeetingIcon, PlusIcon, PrepIcon } from '@/components/icons'
import { PencilCircle, PencilTick } from '@/components/pencil'
import { Button } from '@/components/ui/button'
import { type Change, markDone, setDone, toggleMeetingPrep, togglePrep } from '@/core/actions'
import { currentPeriod, floatingSlotsOfWeek, holidayOn, type LessonSlot, slotsOn, sortedCourses } from '@/core/calendar'
import { addDays, daysBetween, formatLong, formatRange, formatShort, type ISODate, startOfWeek, today, weekday } from '@/core/dates'
import { periodGrades } from '@/core/grading'
import { meetingsOn, openMeetingPrep } from '@/core/meetings'
import { GRADE_LABELS, meetingLabel } from '@/core/model'
import { openPrep } from '@/core/prep'
import { CourseDialog } from '@/features/courses/CourseDialog'
import { LessonDialog } from '@/features/lesson/LessonDialog'
import { MeetingDialog } from '@/features/meetings/MeetingDialog'
import { MeetingCard } from '@/features/meetings/MeetingsPage'
import { cn } from '@/lib/utils'
import { useData } from '@/state/data'

export default function WeekPage() {
  const { data, apply } = useData()
  const now = today()
  // La domenica si guarda già alla settimana che arriva.
  const [monday, setMonday] = useState(() => startOfWeek(weekday(now) === 7 ? addDays(now, 1) : now))
  const [open, setOpen] = useState<{ courseId: string; date: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const [meetingOpen, setMeetingOpen] = useState<string | null>(null)
  const courses = sortedCourses(data)
  const thisWeek = monday === startOfWeek(weekday(now) === 7 ? addDays(now, 1) : now)

  const days = Array.from({ length: 6 }, (_, i) => addDays(monday, i)).map((date) => ({
    date,
    holiday: data.year ? holidayOn(data.year, date) : undefined,
    slots: slotsOn(data, date),
    meetings: meetingsOn(data, date),
  }))
  const floating = floatingSlotsOfWeek(data, monday)
  const hasSaturday = days[5].slots.length > 0 || days[5].meetings.length > 0 || courses.some((c) => c.schedule.some((s) => s.day === 6))
  const unconfirmed = [...days.flatMap((d) => d.slots), ...floating].filter(
    (s) => s.date < now && s.lesson?.activities.length && !s.lesson.done && !s.lesson.cancelled,
  )

  if (courses.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="font-heading text-2xl font-bold">Aggiungi la tua prima classe</h1>
        <p className="text-muted-foreground">
          Con l'orario settimanale, ProfClick ricava da solo tutte le lezioni dell'anno, già senza festività e vacanze.
        </p>
        <Button size="lg" onClick={() => setCreating(true)}>
          <PlusIcon /> Nuova classe
        </Button>
        <CourseDialog open={creating} onClose={() => setCreating(false)} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">{thisWeek ? 'Questa settimana' : 'Settimana'}</h1>
          <p className="text-muted-foreground">{formatRange(monday, addDays(monday, hasSaturday ? 5 : 4))}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Settimana precedente" onClick={() => setMonday(addDays(monday, -7))}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" onClick={() => setMonday(startOfWeek(weekday(now) === 7 ? addDays(now, 1) : now))} disabled={thisWeek}>
            Oggi
          </Button>
          <Button variant="outline" size="icon" aria-label="Settimana successiva" onClick={() => setMonday(addDays(monday, 7))}>
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      {thisWeek && <Alerts />}

      {unconfirmed.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/40 bg-warn/10 p-3">
          <p className="text-sm">
            {unconfirmed.length === 1 ? 'Una lezione passata' : `${unconfirmed.length} lezioni passate`} ancora da segnare.
            Se è andata diversamente, aprila e usa <em>Persa, slitta il piano</em>.
          </p>
          <Button size="sm" onClick={() => apply(markDone(unconfirmed))}>
            <DoneIcon /> Segna tutte fatte
          </Button>
        </div>
      )}

      {floating.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Lezioni della settimana, senza giorno fisso</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {floating.map((slot) => (
              <LessonCard
                key={`${slot.courseId}${slot.date}`}
                slot={slot}
                past={slot.date < now}
                onOpen={() => setOpen({ courseId: slot.courseId, date: slot.date })}
                onToggleDone={() => apply(setDone(slot.courseId, slot.date, !slot.lesson?.done))}
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {days.slice(0, hasSaturday ? 6 : 5).map(({ date, holiday, slots, meetings }) => (
          <section key={date} className="space-y-2">
            <h2 className="flex items-baseline justify-between gap-2 text-sm font-semibold first-letter:uppercase">
              {formatLong(date)}
              {date === now && (
                // Oggi cerchiato a matita blu, come sul diario.
                <span className="relative mr-3 text-xs font-semibold tracking-wide text-pencil-blue normal-case">
                  oggi
                  <PencilCircle />
                </span>
              )}
            </h2>
            {holiday ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{holiday.name}</p>
            ) : slots.length === 0 ? (
              meetings.length === 0 && <p className="px-1 text-sm text-muted-foreground">Nessuna lezione</p>
            ) : (
              slots.map((slot) => (
                <LessonCard
                  key={slot.courseId}
                  slot={slot}
                  past={date < now}
                  onOpen={() => setOpen({ courseId: slot.courseId, date })}
                  onToggleDone={() => apply(setDone(slot.courseId, date, !slot.lesson?.done))}
                />
              ))
            )}
            {meetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} onOpen={() => setMeetingOpen(m.id)} />
            ))}
          </section>
        ))}
      </div>

      {thisWeek && <PrepList />}

      <LessonDialog courseId={open?.courseId ?? ''} date={open?.date ?? null} onClose={() => setOpen(null)} />
      <MeetingDialog open={meetingOpen} onClose={() => setMeetingOpen(null)} />
    </div>
  )
}

/** Quanti giorni prima conviene vedere il materiale da preparare. */
const PREP_HORIZON_DAYS = 21

interface PrepRow {
  id: string
  text: string
  due: ISODate | null
  toggle: Change
  /** Per cosa serve: la classe e l'argomento, o la riunione. */
  source: ReactNode
}

/** Il materiale da preparare per le lezioni e le riunioni delle prossime settimane, con quando serve. */
function PrepList() {
  const { data, apply } = useData()
  const now = today()
  const rows: PrepRow[] = [
    ...openPrep(data, now).map(({ course, item, due }) => ({
      id: item.id,
      text: item.text,
      due,
      toggle: togglePrep(course.id, item.id),
      source: (
        <>
          <CourseName course={course} />
          {item.topicId && data.topics[item.topicId] && ` per ${data.topics[item.topicId].title}`}
        </>
      ),
    })),
    ...openMeetingPrep(data, now).map(({ meeting, item, due }) => ({
      id: item.id,
      text: item.text,
      due,
      toggle: toggleMeetingPrep(meeting.id, item.id),
      source: (
        <span className="inline-flex items-center gap-1.5">
          <MeetingIcon className="size-3.5" /> {meetingLabel(meeting)}
        </span>
      ),
    })),
  ]
  const soon = rows.filter((r) => r.due && daysBetween(now, r.due) <= PREP_HORIZON_DAYS).sort((a, b) => a.due!.localeCompare(b.due!))
  if (soon.length === 0) return null
  const later = rows.length - soon.length

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <PrepIcon className="size-4 text-warn" /> Da preparare
      </h2>
      <ul className="divide-y rounded-xl border bg-card">
        {soon.map((row) => (
          <li key={row.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={false}
              onChange={() => apply(row.toggle)}
              className="size-4 shrink-0 accent-[var(--done)]"
              aria-label={`Pronto: ${row.text}`}
            />
            <span className="min-w-0 flex-1">
              {row.text}
              <span className="block text-xs text-muted-foreground">
                {row.source} · serve {row.due === now ? 'oggi' : formatShort(row.due!)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {later > 0 && <p className="text-xs text-muted-foreground">Altri {later} da preparare più avanti: li trovi negli Appunti delle classi e nelle Riunioni.</p>}
    </section>
  )
}

function LessonCard({ slot, past, onOpen, onToggleDone }: { slot: LessonSlot; past: boolean; onOpen: () => void; onToggleDone: () => void }) {
  const { data } = useData()
  const course = data.courses[slot.courseId]
  const lesson = slot.lesson
  const done = lesson?.done ?? false

  if (lesson?.cancelled) {
    return (
      <button type="button" onClick={onOpen} className="flex w-full items-center justify-between gap-2 rounded-xl border border-dashed p-3 text-left text-muted-foreground">
        <CourseName course={course} className="line-through" />
        <span className="flex items-center gap-1 text-xs">
          <CancelledIcon className="size-4" /> annullata
        </span>
      </button>
    )
  }

  return (
    <div className={cn('flex gap-2 rounded-xl border bg-card p-3 shadow-xs transition-colors', done && 'bg-card/60')}>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 space-y-1.5 text-left">
        <div className="flex items-center justify-between gap-2 text-sm font-semibold">
          <CourseName course={course} />
          <span className="shrink-0 text-xs font-normal text-muted-foreground">
            {slot.floating && `Lezione ${slot.index} · `}
            {formatHours(slot.hours)}
            {slot.lab && ' · ITP'}
          </span>
        </div>
        {lesson?.activities.length ? (
          <div className={cn('space-y-1', done && 'opacity-60')}>
            {lesson.activities.map((a) => (
              <ActivityLine key={a.id} activity={a} data={data} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Da pianificare: tocca per scegliere</p>
        )}
        {lesson?.note && <p className="line-clamp-2 text-xs text-muted-foreground italic">{lesson.note}</p>}
      </button>
      {(lesson?.activities.length ?? 0) > 0 && (
        <button
          type="button"
          onClick={onToggleDone}
          aria-pressed={done}
          aria-label={done ? 'Fatta: tocca per annullare' : 'Segna come fatta'}
          title={done ? 'Fatta' : 'Segna come fatta'}
          className={cn(
            'relative grid size-9 shrink-0 place-items-center self-center rounded-full border-2 transition-colors',
            done ? 'border-border text-pencil-blue' : past ? 'border-warn text-warn' : 'border-border text-muted-foreground/50 hover:text-done',
          )}
        >
          {/* Fatta: la spunta a matita blu, che esce un po' dal cerchio come quella del prof. */}
          {done ? <PencilTick className="absolute -top-1.5 left-0.5 size-8" /> : <DoneIcon className="size-5" />}
        </button>
      )}
    </div>
  )
}

/** Le classi a cui mancano voti nel periodo in corso, con cosa manca. */
function Alerts() {
  const { data } = useData()
  const now = today()
  const period = data.year ? currentPeriod(data.year, now) : undefined
  if (!period) return null
  const alerts = sortedCourses(data)
    .map((course) => ({ course, grades: periodGrades(data, course, period, now) }))
    .filter((a) => a.grades.status !== 'ok')
  if (alerts.length === 0) return null

  return (
    <div className="space-y-2">
      {alerts.map(({ course, grades }) => (
        <Link
          key={course.id}
          to={`/classi/${course.id}`}
          className={cn(
            'flex items-start gap-3 rounded-xl border p-3 text-sm transition-colors hover:bg-muted/50',
            grades.status === 'a-rischio' ? 'border-pencil-red/40' : 'border-warn/40',
          )}
        >
          <AlertIcon className={cn('mt-0.5 size-5 shrink-0', grades.status === 'a-rischio' ? 'text-pencil-red' : 'text-warn')} />
          <span className="min-w-0">
            <CourseName course={course} className="font-semibold" />
            <span className="block text-muted-foreground">
              {period.name}: {grades.full.length} voti previsti su {grades.target}
              {grades.missingTypes.length > 0 && `, manca ${grades.missingTypes.map((t) => GRADE_LABELS[t].toLowerCase()).join(' e ')}`}
              {grades.civics.planned < grades.civics.target - 0.01 &&
                `; educazione civica ${Math.round(grades.civics.planned * 10) / 10} ore su ${grades.civics.target}`}
              .
              {' '}
              {grades.freeLessons} lezioni ancora libere. Tocca per la proposta di piano.
            </span>
          </span>
        </Link>
      ))}
    </div>
  )
}
