import { createElement, useState } from 'react'
import { toast } from 'sonner'
import { ActivityLine, CourseName, Segmented, Toggle } from '@/components/bits'
import { CalendarAddIcon, CancelledIcon, DoneIcon, type IconComponent, NoteIcon, RegisterIcon, ShiftIcon, TrashIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { addActivity, cancelAndShift, removeActivity, replaceActivity, setActivityReady, setCancelled, setDone, setNote } from '@/core/actions'
import { courseSlots } from '@/core/calendar'
import { assessmentEntry, googleCalendarLink } from '@/core/calendarExport'
import { formatDay, formatLong, type ISODate, startOfWeek } from '@/core/dates'
import { type Activity, type ActivityKind, type Assessment, GRADE_LABELS, type GradeType, lessonKey } from '@/core/model'
import { courseTopics, TEACHING_KINDS, topicAround, topicsSinceLastAssessment } from '@/core/progress'
import { lessonRegisterText } from '@/core/registerText'
import { needsPrep } from '@/core/todo'
import { activityIcon } from '@/lib/activityIcons'
import { newId } from '@/lib/id'
import { formatHours } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { useAutosave } from '@/lib/useAutosave'
import { useData } from '@/state/data'

/** Peso segnaposto del voto minore: al momento di aggiungerlo diventa quello proposto dalla classe. */
const MINOR = -1

type QuickAdd = { label: string; kind: ActivityKind; assessment?: Assessment }

/**
 * I pulsanti per aggiungere un'attività: in vista le quattro di tutti i giorni, le altre a un
 * tocco. La verifica nasce scritta, o pratica nelle ore con l'ITP; il tipo si cambia dopo.
 */
const MAIN_ADD: QuickAdd[] = [
  { label: 'Spiegazione', kind: 'spiegazione' },
  { label: 'Esercitazione', kind: 'esercitazione' },
  { label: 'Laboratorio', kind: 'laboratorio' },
  { label: 'Verifica', kind: 'verifica', assessment: { type: 'scritto', weight: 100, continues: false } },
]
const MORE_ADD: QuickAdd[] = [
  { label: 'Ripasso', kind: 'ripasso' },
  { label: 'Voto minore', kind: 'verifica', assessment: { type: 'pratico', weight: MINOR, continues: false } },
  { label: 'Ed. civica', kind: 'civica' },
  { label: 'Altro', kind: 'altro' },
]

/** Con pochi argomenti si vedono tutti; con tanti, quelli vicini alla lezione. */
const ALL_TOPICS_UP_TO = 5

export function LessonDialog({ courseId, date, onClose }: { courseId: string; date: ISODate | null; onClose: () => void }) {
  return (
    <Dialog open={date !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        {date && <LessonEditor courseId={courseId} date={date} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function LessonEditor({ courseId, date, onClose }: { courseId: string; date: ISODate; onClose: () => void }) {
  const { data, apply, applyWithUndo } = useData()
  const course = data.courses[courseId]
  const lesson = data.lessons[lessonKey(courseId, date)]
  const [noteOpen, setNoteOpen] = useState(Boolean(lesson?.note))
  const [moreOpen, setMoreOpen] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const note = useAutosave((value) => course && value !== (lesson?.note ?? '') && apply(setNote(courseId, date, value)))
  if (!course) return null

  const slot = courseSlots(data, course, date, date)[0]
  const activities = lesson?.activities ?? []
  const done = lesson?.done ?? false
  const cancelled = lesson?.cancelled ?? false
  // Una lezione senza giorno fisso non ha una data vera: si dice quale lezione è della settimana.
  const when = slot?.floating ? `Lezione ${slot.index} della settimana del ${formatDay(startOfWeek(date))}` : formatLong(date)

  const add = (item: QuickAdd) => {
    const teaching = TEACHING_KINDS.includes(item.kind)
    const assessment = item.assessment && {
      ...item.assessment,
      type: item.assessment.weight === MINOR || !slot?.lab ? item.assessment.type : ('pratico' as const),
      weight: item.assessment.weight === MINOR ? course.rules.minorWeight : item.assessment.weight,
    }
    const topicIds = teaching
      ? [topicAround(data, course, date)?.id].filter((id): id is string => Boolean(id))
      : assessment && assessment.weight >= 100
        ? topicsSinceLastAssessment(data, course, date)
        : []
    apply(addActivity(courseId, date, { id: newId(), kind: item.kind, topicIds, text: '', assessment }))
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-x-2 text-lg">
          <CourseName course={course} />
        </DialogTitle>
        <DialogDescription>
          {when} · {formatHours(slot?.hours ?? 0)}
          {slot?.lab && ' · con ITP'}
        </DialogDescription>
      </DialogHeader>

      {cancelled ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
          <span className="flex items-center gap-2 text-muted-foreground">
            <CancelledIcon className="size-5" /> Lezione saltata
          </span>
          <Button variant="outline" size="sm" onClick={() => apply(setCancelled(courseId, date, false))}>
            Ripristina
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {activities.length === 0 && <p className="text-muted-foreground">Niente in programma. Scegli cosa fare:</p>}
            {activities.map((a) => (
              <ActivityEditor key={a.id} courseId={courseId} date={date} activity={a} />
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[...MAIN_ADD, ...(moreOpen ? MORE_ADD : [])].map((item) => (
              <Button key={item.label} variant="outline" size="sm" onClick={() => add(item)}>
                {createElement(activityIcon(item.assessment ? { ...item, assessment: { ...item.assessment, weight: item.assessment.weight === MINOR ? 50 : 100 } } : item), {
                  className: item.kind === 'verifica' ? 'text-pencil-red' : 'text-pencil-blue',
                })}
                {item.label}
              </Button>
            ))}
            {!moreOpen && (
              <Button variant="ghost" size="sm" onClick={() => setMoreOpen(true)}>
                Ripasso, voto minore, ed. civica…
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {!noteOpen && (
              <Button variant="ghost" size="sm" onClick={() => setNoteOpen(true)}>
                <NoteIcon /> Aggiungi un appunto
              </Button>
            )}
            {activities.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  navigator.clipboard.writeText(lessonRegisterText(data, { lesson })).then(
                    () => toast.success('Copiato: ora incollalo nel registro'),
                    () => toast.error('Copia non riuscita'),
                  )
                }
              >
                <RegisterIcon /> Copia per il registro
              </Button>
            )}
          </div>
          {noteOpen && (
            <Textarea
              placeholder="Appunti su questa lezione: cosa è rimasto indietro, chi era assente, cosa portare…"
              defaultValue={lesson?.note ?? ''}
              {...note}
              rows={3}
            />
          )}
        </>
      )}

      {skipping && !cancelled && (
        // Gita, sciopero, assemblea: le due strade spiegate per esteso, perché da telefono un suggerimento non si vede.
        <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm font-medium">Lezione saltata. Quello che era previsto…</p>
          <SkipChoice
            icon={ShiftIcon}
            title="Slitta alla lezione dopo"
            detail="Tutto il piano da qui in avanti si sposta di una lezione."
            onClick={() => {
              applyWithUndo(cancelAndShift(courseId, date), 'Lezione saltata: il piano è slittato di una lezione')
              onClose()
            }}
          />
          <SkipChoice
            icon={CancelledIcon}
            title="Si toglie"
            detail="Il resto del piano resta dov'è."
            onClick={() => {
              applyWithUndo(
                (d) => setCancelled(courseId, date, true)(activities.reduce((x, a) => removeActivity(courseId, date, a.id)(x), d)),
                'Lezione saltata',
              )
              setSkipping(false)
            }}
          />
          <Button variant="ghost" size="sm" onClick={() => setSkipping(false)}>
            Indietro
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        {!cancelled && !skipping && (
          <Button
            variant="ghost"
            size="sm"
            // Senza niente in programma non c'è niente da spostare: si salta e basta.
            onClick={() => (activities.length > 0 ? setSkipping(true) : apply(setCancelled(courseId, date, true)))}
          >
            <CancelledIcon /> Lezione saltata
          </Button>
        )}
        {!cancelled && (
          <Button
            variant={done ? 'secondary' : 'default'}
            onClick={() => {
              apply(setDone(courseId, date, !done))
              if (!done) {
                toast.success('Lezione fatta')
                onClose()
              }
            }}
            className={cn(done && 'text-done')}
          >
            <DoneIcon />
            {done ? 'Fatta' : 'Segna come fatta'}
          </Button>
        )}
      </div>
    </>
  )
}

function SkipChoice({ icon: Icon, title, detail, onClick }: { icon: IconComponent; title: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/40">
      <Icon className="mt-0.5 size-5 shrink-0 text-pencil-blue" />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </button>
  )
}

function ActivityEditor({ courseId, date, activity }: { courseId: string; date: ISODate; activity: Activity }) {
  const { data, apply } = useData()
  const course = data.courses[courseId]
  const topics = courseTopics(data, courseId)
  const update = (patch: Partial<Activity>) => apply(replaceActivity(courseId, date, { ...activity, ...patch }))
  const text = useAutosave((value) => value !== activity.text && update({ text: value }))
  const a = activity.assessment
  const setAssessment = (patch: Partial<Assessment>) => a && update({ assessment: { ...a, ...patch } })
  const toggleTopic = (id: string) =>
    update({ topicIds: activity.topicIds.includes(id) ? activity.topicIds.filter((t) => t !== id) : [...activity.topicIds, id] })
  const [allTopics, setAllTopics] = useState(false)
  // Gli argomenti vicini: quelli scelti, quello in corso, il precedente e il successivo.
  const around = topics.findIndex((t) => t.id === topicAround(data, course, date)?.id)
  const near = new Set([...activity.topicIds, ...(around >= 0 ? topics.slice(Math.max(0, around - 1), around + 2).map((t) => t.id) : [])])
  const shownTopics = allTopics || topics.length <= ALL_TOPICS_UP_TO ? topics : topics.filter((t) => near.has(t.id))

  return (
    <div className="space-y-2.5 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <ActivityLine activity={{ ...activity, topicIds: [], text: '' }} data={data} />
        <Button variant="ghost" size="icon-sm" aria-label="Togli attività" onClick={() => apply(removeActivity(courseId, date, activity.id))}>
          <TrashIcon />
        </Button>
      </div>

      {a && (
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<GradeType>
            value={a.type}
            onChange={(type) => setAssessment({ type })}
            options={(['scritto', 'teorico', 'pratico'] as const).map((t) => ({ value: t, label: GRADE_LABELS[t] }))}
          />
          <Toggle on={a.weight < 100} onClick={() => setAssessment({ weight: a.weight < 100 ? 100 : course.rules.minorWeight })}>
            Voto minore
          </Toggle>
          {a.weight < 100 && (
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              peso
              <Input
                key={a.weight}
                type="number"
                min={5}
                max={95}
                step={5}
                defaultValue={a.weight}
                onBlur={(e) => Number(e.target.value) !== a.weight && setAssessment({ weight: Math.min(95, Math.max(5, Number(e.target.value) || 5)) })}
                className="h-7 w-16 text-center"
              />
              %
            </label>
          )}
          <Toggle on={a.continues} onClick={() => setAssessment({ continues: !a.continues })}>
            Seconda parte della precedente
          </Toggle>
        </div>
      )}

      {topics.length > 0 && activity.kind !== 'civica' && (
        <div className="flex flex-wrap gap-1.5" aria-label="Argomenti">
          {shownTopics.map((t) => (
            <Toggle
              key={t.id}
              on={activity.topicIds.includes(t.id)}
              onClick={() => toggleTopic(t.id)}
              className={cn(!activity.topicIds.includes(t.id) && t.completed && 'opacity-60')}
            >
              {t.title}
            </Toggle>
          ))}
          {shownTopics.length < topics.length && (
            <button type="button" onClick={() => setAllTopics(true)} className="px-1.5 text-xs font-medium text-primary hover:underline">
              Tutti gli argomenti ({topics.length})
            </button>
          )}
        </div>
      )}

      <Input
        placeholder={
          activity.kind === 'verifica'
            ? 'Dettagli: con orale, gruppo, consegna…'
            : activity.kind === 'civica'
              ? 'Tema: Agenda 2030, cittadinanza digitale…'
              : 'Dettagli: esercizi, pagine, materiale…'
        }
        defaultValue={activity.text}
        {...text}
        className="h-8"
      />

      {/* La stessa spunta della lista Da fare. */}
      {needsPrep(activity) && !data.lessons[lessonKey(courseId, date)]?.done && (
        <Toggle on={Boolean(activity.ready)} onClick={() => apply(setActivityReady(courseId, date, activity.id, !activity.ready))}>
          {activity.ready ? 'Materiale pronto' : 'Materiale da preparare'}
        </Toggle>
      )}

      {a && !a.continues && (
        <a
          href={googleCalendarLink(assessmentEntry(data, course, date, activity))}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <CalendarAddIcon className="size-4" /> Aggiungi a Google Calendar
        </a>
      )}
    </div>
  )
}
