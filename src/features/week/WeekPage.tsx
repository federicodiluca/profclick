import { useEffect, useRef, useState } from 'react'
import { Link } from 'wouter'
import { ActivityLine, CourseName } from '@/components/bits'
import { formatHours } from '@/lib/ui'
import { CalendarAddIcon, CancelledIcon, ChevronLeftIcon, ChevronRightIcon, DoneIcon, PlusIcon, PrepIcon, RegisterIcon } from '@/components/icons'
import { PencilCircle, PencilStrike, PencilTick } from '@/components/pencil'
import { Button } from '@/components/ui/button'
import { setDone } from '@/core/actions'
import { floatingSlotsOfWeek, holidayOn, type LessonSlot, slotsOn, sortedCourses, weekToShow } from '@/core/calendar'
import { addDays, formatLong, formatRange, type ISODate, today, weekday } from '@/core/dates'
import { meetingsOn } from '@/core/meetings'
import { lessonRegisterText } from '@/core/registerText'
import { todoCourse, todos } from '@/core/todo'
import { CourseDialog } from '@/features/courses/CourseDialog'
import { LessonDialog } from '@/features/lesson/LessonDialog'
import { AddLessonDialog } from '@/features/lesson/LessonTime'
import { MeetingDialog } from '@/features/meetings/MeetingDialog'
import { MeetingCard } from '@/features/meetings/MeetingsPage'
import { cn } from '@/lib/utils'
import { isAutoDone, isDone } from '@/core/model'
import { useData } from '@/state/data'
import { useHiddenCourses } from '@/state/weekFilter'
import { CourseFilter } from './CourseFilter'
import { RegisterDialog } from './RegisterDialog'

export default function WeekPage() {
  const { data, apply } = useData()
  const now = today()
  // Finita la scuola della settimana (il sabato, se non c'è lezione) si guarda già a quella che arriva.
  const [monday, setMonday] = useState(() => weekToShow(data, now))
  const [open, setOpen] = useState<{ courseId: string; date: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const [meetingOpen, setMeetingOpen] = useState<string | null>(null)
  const [register, setRegister] = useState(false)
  const [adding, setAdding] = useState<ISODate | null>(null)
  const courses = sortedCourses(data)
  const { hidden, toggle, showAll } = useHiddenCourses()
  const shown = (slot: LessonSlot) => !hidden.has(slot.courseId)
  const thisWeek = monday === weekToShow(data, now)

  const days = Array.from({ length: 6 }, (_, i) => addDays(monday, i)).map((date) => {
    const all = slotsOn(data, date)
    return {
      date,
      holiday: data.year ? holidayOn(data.year, date) : undefined,
      slots: all.filter(shown),
      hiddenSlots: all.length - all.filter(shown).length,
      meetings: meetingsOn(data, date),
    }
  })
  const floating = floatingSlotsOfWeek(data, monday).filter(shown)
  const hasSaturday = days[5].slots.length + days[5].hiddenSlots > 0 || days[5].meetings.length > 0 || courses.some((c) => c.schedule.some((s) => s.day === 6))
  // Per il registro: le lezioni fino a oggi, delle classi accese, con qualcosa da scrivere.
  const forRegister = [...days.flatMap((d) => d.slots), ...floating].filter((s) => s.date <= now && lessonRegisterText(data, s))
  // Le lezioni da oggi in poi ancora vuote: quelle passate senza nulla sono andate comunque.
  const unplanned = [...days.flatMap((d) => d.slots), ...floating]
    .filter((s) => s.date >= now && !s.lesson?.cancelled && !s.lesson?.activities.length)
    .sort((a, b) => a.date.localeCompare(b.date))
  const upcoming = [...days.flatMap((d) => d.slots), ...floating].filter((s) => s.date >= now && !s.lesson?.cancelled).length

  // Da telefono le giornate stanno in colonna: all'apertura si parte da oggi, non dal lunedì.
  const todayRef = useRef<HTMLElement>(null)
  // Si decide alla prima apertura: cambiando settimana o spuntando, la pagina resta dov'è.
  const [scrollToToday] = useState(() => weekday(now) > 1)
  useEffect(() => {
    if (scrollToToday && window.matchMedia('(max-width: 767px)').matches) todayRef.current?.scrollIntoView({ block: 'start' })
  }, [scrollToToday])

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
          {forRegister.length > 0 && (
            <Button variant="outline" onClick={() => setRegister(true)} aria-label="Argomenti per il registro" title="Gli argomenti delle lezioni, da incollare nel registro">
              <RegisterIcon />
              <span className="hidden sm:inline">Registro</span>
            </Button>
          )}
          <Button variant="outline" size="icon" aria-label="Settimana precedente" onClick={() => setMonday(addDays(monday, -7))}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" onClick={() => setMonday(weekToShow(data, now))} disabled={thisWeek}>
            Oggi
          </Button>
          <Button variant="outline" size="icon" aria-label="Settimana successiva" onClick={() => setMonday(addDays(monday, 7))}>
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      {data.year && now > data.year.end && (
        <Link to="/anno" className="block rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm transition-colors hover:bg-primary/10">
          Le lezioni del {data.year.label} sono finite. Quando vuoi, dalla pagina Anno passi all'anno nuovo: i programmi restano, da copiare nelle
          classi nuove.
        </Link>
      )}

      {courses.length > 1 && <CourseFilter courses={courses} hidden={hidden} onToggle={toggle} onShowAll={showAll} />}

      {upcoming > 0 && (
        <WeekStatus
          monday={monday}
          hidden={hidden}
          missing={unplanned.length}
          thisWeek={thisWeek}
          onPlan={() => setOpen({ courseId: unplanned[0].courseId, date: unplanned[0].date })}
        />
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
        {days.slice(0, hasSaturday ? 6 : 5).map(({ date, holiday, slots, hiddenSlots, meetings }) => (
          <section key={date} ref={date === now ? todayRef : undefined} className="scroll-mt-3 space-y-2">
            <h2 className="flex items-center justify-between gap-2 text-sm font-semibold">
              <span className="first-letter:uppercase">{formatLong(date)}</span>
              <span className="flex items-center gap-2">
                {date === now && (
                  // Oggi cerchiato a matita blu, come sul diario.
                  <span className="relative mr-1 text-xs font-semibold tracking-wide text-pencil-blue">
                    oggi
                    <PencilCircle />
                  </span>
                )}
                {/* Supplenza, recupero, ora scambiata: una lezione fuori dall'orario. */}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 text-muted-foreground"
                  aria-label={`Aggiungi una lezione ${formatLong(date)}`}
                  title="Aggiungi una lezione fuori orario"
                  onClick={() => setAdding(date)}
                >
                  <PlusIcon />
                </Button>
              </span>
            </h2>
            {holiday && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{holiday.name}</p>}
            {!holiday && slots.length === 0 && meetings.length === 0 && (
              <p className="px-1 text-sm text-muted-foreground">
                {hiddenSlots === 0 ? 'Nessuna lezione' : hiddenSlots === 1 ? 'Una lezione di una classe nascosta' : `${hiddenSlots} lezioni di classi nascoste`}
              </p>
            )}
            {/* Anche in un giorno di vacanza, se ci si è messa una lezione in più. */}
            {slots.map((slot) => (
              <LessonCard
                key={slot.courseId}
                slot={slot}
                past={date < now}
                onOpen={() => setOpen({ courseId: slot.courseId, date })}
                onToggleDone={() => apply(setDone(slot.courseId, date, !slot.lesson?.done))}
              />
            ))}
            {meetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} onOpen={() => setMeetingOpen(m.id)} />
            ))}
          </section>
        ))}
      </div>

      <LessonDialog courseId={open?.courseId ?? ''} date={open?.date ?? null} onClose={() => setOpen(null)} />
      <MeetingDialog open={meetingOpen} onClose={() => setMeetingOpen(null)} />
      <AddLessonDialog
        date={adding}
        onClose={() => setAdding(null)}
        onAdded={(courseId, date) => {
          setAdding(null)
          setOpen({ courseId, date })
        }}
      />
      <RegisterDialog slots={forRegister} open={register} onClose={() => setRegister(false)} />
    </div>
  )
}

/**
 * A che punto è la settimana, in una riga: prima se le lezioni da qui in avanti hanno tutte
 * qualcosa in programma, poi se quello che serve è pronto (la lista sta nel Da fare).
 */
function WeekStatus({ monday, hidden, missing, thisWeek, onPlan }: { monday: ISODate; hidden: Set<string>; missing: number; thisWeek: boolean; onPlan: () => void }) {
  const { data } = useData()
  const week = thisWeek ? 'questa settimana' : 'della settimana'
  // In questa settimana anche quello rimasto indietro, come il verbale di una riunione passata.
  const prep = todos(data, today(), addDays(monday, 6)).filter((t) => t.due && (thisWeek || t.due >= monday) && !hidden.has(todoCourse(t)?.id ?? ''))
  const open = prep.filter((t) => !t.done).length
  const row = 'flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left text-sm shadow-xs'
  const action = (label: string) => (
    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
      {label} <ChevronRightIcon className="size-4" />
    </span>
  )

  if (missing > 0) {
    return (
      <button type="button" onClick={onPlan} className={cn(row, 'transition-colors hover:bg-muted/40')}>
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <CalendarAddIcon className="size-5 shrink-0 text-muted-foreground" />
          {missing === 1 ? `Una lezione ${week} è ancora da pianificare` : `${missing} lezioni ${week} sono ancora da pianificare`}
        </span>
        {action('Pianifica')}
      </button>
    )
  }
  if (open === 0) {
    return (
      <p className={cn(row, 'justify-start font-medium')}>
        <DoneIcon className="size-5 shrink-0 text-done" />
        {prep.length > 0 ? `Tutto pianificato e pronto per ${thisWeek ? 'questa settimana' : 'la settimana'}` : `Tutte le lezioni ${thisWeek ? 'di questa settimana' : 'della settimana'} sono pianificate`}
      </p>
    )
  }
  return (
    <Link to="/da-fare" className={cn(row, 'transition-colors hover:bg-muted/40')}>
      <span className="flex min-w-0 items-center gap-2 font-medium">
        <PrepIcon className="size-5 shrink-0 text-warn" />
        {`Tutto pianificato: controlla cosa c'è da preparare (${open === 1 ? 'una cosa' : `${open} cose`})`}
      </span>
      {action(`${prep.length - open} di ${prep.length} pronte`)}
    </Link>
  )
}

/** "2ª ora", o "2ª–3ª ora" per una lezione di due ore. */
function schoolHours(start: number, hours: number): string {
  const end = start + Math.ceil(hours) - 1
  return end > start ? `${start}ª–${end}ª ora` : `${start}ª ora`
}

function LessonCard({ slot, past, onOpen, onToggleDone }: { slot: LessonSlot; past: boolean; onOpen: () => void; onToggleDone: () => void }) {
  const { data } = useData()
  const course = data.courses[slot.courseId]
  const lesson = slot.lesson
  const done = isDone(lesson)
  const auto = isAutoDone(lesson)
  const planned = (lesson?.activities.length ?? 0) > 0

  if (lesson?.cancelled) {
    return (
      <button type="button" onClick={onOpen} className="flex w-full items-center justify-between gap-2 rounded-xl border border-dashed p-3 text-left text-muted-foreground">
        {/* Saltata: barrata a matita rossa, come sul registro. */}
        <span className="relative min-w-0">
          <CourseName course={course} />
          <PencilStrike className="text-pencil-red" />
        </span>
        <span className="flex items-center gap-1 text-xs">
          <CancelledIcon className="size-4" /> saltata
        </span>
      </button>
    )
  }

  return (
    <div
      className={cn(
        'flex gap-2 rounded-xl border p-3 transition-colors',
        // Vuota: un riquadro tratteggiato da riempire; pianificata: un foglio pieno.
        // Una lezione passata senza niente segnato non è un problema: è andata, e basta.
        planned ? 'bg-card shadow-xs' : past ? 'bg-card/60' : 'border-dashed border-muted-foreground/30 bg-transparent hover:bg-muted/40',
        done && 'bg-card/60',
      )}
    >
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 space-y-1.5 text-left">
        <div className="flex items-center justify-between gap-2 text-sm font-semibold">
          <CourseName course={course} />
          <span className="shrink-0 text-xs font-normal text-muted-foreground">
            {slot.floating && `Lezione ${slot.index} · `}
            {slot.start ? schoolHours(slot.start, slot.hours) : formatHours(slot.hours)}
            {slot.lab && ' · ITP'}
            {slot.extra && ' · in più'}
          </span>
        </div>
        {planned ? (
          <div className={cn('space-y-1', done && 'opacity-60')}>
            {lesson!.activities.map((a) => (
              <ActivityLine key={a.id} activity={a} data={data} />
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {past ? (
              'Niente segnato'
            ) : (
              <>
                <PlusIcon className="size-4 shrink-0" /> Da pianificare: tocca per scegliere
              </>
            )}
          </p>
        )}
        {lesson?.note && <p className="line-clamp-2 text-xs text-muted-foreground italic">{lesson.note}</p>}
      </button>
      {planned && (
        <button
          type="button"
          onClick={onToggleDone}
          // Passata: conta da sola come fatta. Se non è andata così, si apre e si salta o si sposta.
          disabled={auto}
          aria-pressed={done}
          aria-label={auto ? 'Fatta' : done ? 'Fatta: tocca per annullare' : 'Segna come fatta'}
          title={auto ? 'Fatta: è passata. Se non è andata così, aprila' : done ? 'Fatta' : 'Segna come fatta'}
          className={cn(
            'relative grid size-9 shrink-0 place-items-center self-center rounded-full border-2 transition-colors',
            done ? 'border-border text-pencil-blue' : 'border-border text-muted-foreground/50 hover:text-done',
          )}
        >
          {/* Fatta: la spunta a matita blu, che esce un po' dal cerchio come quella del prof. */}
          {done ? <PencilTick className="absolute -top-1.5 left-0.5 size-8" /> : <DoneIcon className="size-5" />}
        </button>
      )}
    </div>
  )
}
