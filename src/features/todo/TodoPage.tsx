import { useState } from 'react'
import { Link } from 'wouter'
import { ActivityLine, CourseName, ProgressBar } from '@/components/bits'
import { DoneIcon, MeetingIcon } from '@/components/icons'
import { PencilUnderline } from '@/components/pencil'
import { Button } from '@/components/ui/button'
import { sortedCourses } from '@/core/calendar'
import { addDays, formatDay, formatShort, type ISODate, startOfWeek, today, weekday } from '@/core/dates'
import { meetingLabel } from '@/core/model'
import { setTodosDone, type Todo, todoCourse, todos, toggleTodo } from '@/core/todo'
import { LessonDialog } from '@/features/lesson/LessonDialog'
import { MeetingDialog } from '@/features/meetings/MeetingDialog'
import { CourseFilter } from '@/features/week/CourseFilter'
import { formatHours } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { useData } from '@/state/data'
import { useHiddenCourses } from '@/state/weekFilter'

/** Le settimane in vista all'apertura: abbastanza per preparare con calma, non tutto l'anno. */
const WEEKS = 3

/**
 * Tutto quello da preparare per le prossime settimane, da spuntare in un posto solo: le
 * attività delle lezioni pianificate, le voci scritte nelle classi, quelle delle riunioni.
 */
export default function TodoPage() {
  const { data, applyWithUndo } = useData()
  const now = today()
  const [weeks, setWeeks] = useState(WEEKS)
  const [open, setOpen] = useState<{ courseId: string; date: ISODate } | null>(null)
  const [meetingOpen, setMeetingOpen] = useState<string | null>(null)
  const { hidden, toggle, showAll } = useHiddenCourses()
  const courses = sortedCourses(data)
  // Come nella settimana: la domenica si guarda già alla settimana che arriva.
  const monday = startOfWeek(weekday(now) === 7 ? addDays(now, 1) : now)
  const until = addDays(monday, weeks * 7 - 1)
  const list = todos(data, now, until).filter((t) => !hidden.has(todoCourse(t)?.id ?? ''))
  const yearEnded = !data.year || until >= data.year.end

  const groups = new Map<ISODate, Todo[]>()
  for (const todo of list.filter((t) => t.due)) {
    const week = startOfWeek(todo.due!) < monday ? monday : startOfWeek(todo.due!)
    groups.set(week, [...(groups.get(week) ?? []), todo])
  }
  const undated = list.filter((t) => !t.due)
  const weekTitle = (week: ISODate) =>
    week === monday ? 'Questa settimana' : week === addDays(monday, 7) ? 'Settimana prossima' : `Settimana del ${formatDay(week).replace(/ \d{4}$/, '')}`

  const markAll = (items: Todo[]) => {
    const open = items.filter((t) => !t.done).length
    // Tutto già pronto: lo stesso pulsante toglie le spunte, per chi ha esagerato.
    const done = open > 0
    const count = done ? open : items.length
    const message = done
      ? count === 1 ? 'Una voce pronta' : `${count} voci pronte`
      : count === 1 ? 'Una voce di nuovo da preparare' : `${count} voci di nuovo da preparare`
    applyWithUndo(setTodosDone(items, done), message)
  }
  const openCount = list.filter((t) => !t.done).length

  const onOpen = (todo: Todo) => {
    const s = todo.source
    if (s.kind === 'activity') setOpen({ courseId: s.course.id, date: todo.due! })
    else if (s.kind === 'meeting') setMeetingOpen(s.meeting.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            <span className="relative text-foreground">
              Da fare
              <PencilUnderline className="text-pencil-blue" />
            </span>
          </h1>
          <p className="mt-1 text-muted-foreground">Quello da preparare per le prossime lezioni e riunioni.</p>
        </div>
        {openCount > 1 && (
          <Button variant="outline" onClick={() => markAll(list)}>
            <DoneIcon /> Segna tutto pronto
          </Button>
        )}
      </div>

      {courses.length > 1 && <CourseFilter courses={courses} hidden={hidden} onToggle={toggle} onShowAll={showAll} />}

      {list.length === 0 ? (
        <div className="space-y-2 rounded-xl border border-dashed p-6 text-center">
          <p className="font-medium">Niente da preparare nelle prossime {weeks} settimane.</p>
          <p className="text-sm text-muted-foreground">
            Le voci nascono da sole dalle lezioni pianificate: ogni spiegazione, esercitazione, laboratorio o verifica scritta diventa una cosa da preparare.
            Pianifica dalla <Link to="/" className="font-medium text-primary hover:underline">Settimana</Link> o dal piano di una classe.
          </p>
        </div>
      ) : (
        <>
          {[...groups].map(([week, items]) => (
            <TodoGroup key={week} title={weekTitle(week)} items={items} now={now} onOpen={onOpen} onMarkAll={() => markAll(items)} />
          ))}
          {undated.length > 0 && (
            <TodoGroup
              title="Senza data"
              hint="Voci delle classi per argomenti non ancora in calendario: prendono una data quando li pianifichi."
              items={undated}
              now={now}
              onOpen={onOpen}
              onMarkAll={() => markAll(undated)}
            />
          )}
        </>
      )}

      {!yearEnded && (
        <Button variant="outline" onClick={() => setWeeks(weeks + 2)}>
          Mostra altre due settimane
        </Button>
      )}

      <LessonDialog courseId={open?.courseId ?? ''} date={open?.date ?? null} onClose={() => setOpen(null)} />
      <MeetingDialog open={meetingOpen} onClose={() => setMeetingOpen(null)} />
    </div>
  )
}

function TodoGroup({
  title,
  hint,
  items,
  now,
  onOpen,
  onMarkAll,
}: {
  title: string
  hint?: string
  items: Todo[]
  now: ISODate
  onOpen: (todo: Todo) => void
  onMarkAll: () => void
}) {
  const ready = items.filter((t) => t.done).length
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {ready === items.length ? 'tutto pronto' : `${ready} di ${items.length} pronte`}
          {items.length > 1 && (
            <Button variant="ghost" size="sm" onClick={onMarkAll} className="h-7 px-2 text-xs text-primary">
              {ready === items.length ? 'Togli le spunte' : 'Tutte pronte'}
            </Button>
          )}
        </span>
      </div>
      <ProgressBar value={ready} max={items.length} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <ul className="divide-y rounded-xl border bg-card">
        {items.map((todo) => (
          <TodoRow key={todo.id} todo={todo} now={now} onOpen={() => onOpen(todo)} />
        ))}
      </ul>
    </section>
  )
}

function TodoRow({ todo, now, onOpen }: { todo: Todo; now: ISODate; onOpen: () => void }) {
  const { data, apply } = useData()
  const s = todo.source
  const toggle = () => apply(toggleTodo(todo))
  const when = !todo.due
    ? null
    : s.kind === 'activity' && s.floating
      ? `lezione ${s.index} della settimana`
      : todo.due === now
        ? 'oggi'
        : todo.due === addDays(now, 1)
          ? 'domani'
          : formatShort(todo.due)
  const topic = s.kind === 'prep' && s.item.topicId ? data.topics[s.item.topicId]?.title : undefined

  const body = (
    <>
      {s.kind === 'activity' ? (
        <ActivityLine activity={s.activity} data={data} />
      ) : (
        <span className="block text-sm font-medium">{s.item.text}</span>
      )}
      <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        {s.kind === 'meeting' ? (
          <span className="inline-flex items-center gap-1.5">
            <MeetingIcon className="size-3.5" /> {meetingLabel(s.meeting)}
          </span>
        ) : (
          <CourseName course={s.course} />
        )}
        {topic && <span>· per {topic}</span>}
        {when && <span>· {when}</span>}
        {/* Quanto dura la lezione: cambia quanto materiale serve. */}
        {s.kind === 'activity' && <span>· {formatHours(s.hours)}</span>}
      </span>
    </>
  )

  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <input
        type="checkbox"
        checked={todo.done}
        onChange={toggle}
        className="mt-0.5 size-4 shrink-0 accent-[var(--done)]"
        aria-label={todo.done ? 'Pronto: tocca per annullare' : 'Segna come pronto'}
      />
      {s.kind === 'prep' ? (
        <div className={cn('min-w-0 flex-1', todo.done && 'text-muted-foreground line-through opacity-70')}>{body}</div>
      ) : (
        <button type="button" onClick={onOpen} className={cn('min-w-0 flex-1 text-left', todo.done && 'line-through opacity-60')}>
          {body}
        </button>
      )}
    </li>
  )
}
