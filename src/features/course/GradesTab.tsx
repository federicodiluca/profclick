import { createElement } from 'react'
import { Section } from '@/components/bits'
import { CivicsIcon, DoneIcon, MinorGradeIcon } from '@/components/icons'
import { formatShort, today } from '@/core/dates'
import { type GradeEvent, periodGrades } from '@/core/grading'
import { assessmentLabel, type Course, GRADE_LABELS, isMinor, weeklyHours } from '@/core/model'
import { GRADE_ICONS } from '@/lib/activityIcons'
import { formatHours } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { useData } from '@/state/data'

/** Per ogni periodo: quanti voti servono, quali tipi ci sono, quando cadono. */
export function GradesTab({ course }: { course: Course }) {
  const { data } = useData()
  const now = today()
  const rule = course.rules.perPeriod === null ? `un voto per ogni ora settimanale (${weeklyHours(course)})` : `${course.rules.perPeriod} voti`

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Regola: {rule}
        {course.rules.required.length > 0 && `, con almeno uno ${course.rules.required.map((t) => GRADE_LABELS[t].toLowerCase()).join(', ')}`}. I voti minori
        si aggiungono a questi.
      </p>
      {data.year!.periods.map((period) => {
        const g = periodGrades(data, course, period, now)
        const unplacedFull = g.unplaced.filter((u) => !isMinor(u.planned)).length
        const toPlan = Math.max(0, g.missing - unplacedFull)
        return (
          <Section
            key={period.id}
            title={period.name}
            action={
              <span className="text-sm text-muted-foreground">
                {g.done} {g.done === 1 ? 'fatto' : 'fatti'} · {g.full.length} in calendario su {g.target}
              </span>
            }
          >
            <div className="flex flex-wrap gap-2">
              {course.rules.required.map((t) => {
                const ok = !g.missingTypes.includes(t)
                return (
                  <span
                    key={t}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                      ok ? 'border-done/40 text-done' : 'border-pencil-red/40 text-pencil-red',
                    )}
                  >
                    {createElement(GRADE_ICONS[t], { className: 'size-3.5' })}
                    {GRADE_LABELS[t]} {ok ? 'in calendario' : 'mancante'}
                  </span>
                )
              })}
              {g.civics.target > 0 && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                    g.civics.planned >= g.civics.target - 0.01 ? 'border-done/40 text-done' : 'border-warn/50 text-warn',
                  )}
                >
                  <CivicsIcon className="size-3.5" />
                  Ed. civica: {formatHours(g.civics.planned)} su {g.civics.target}
                </span>
              )}
            </div>
            <ul className="divide-y rounded-xl border">
              {[...g.full, ...g.minor]
                .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
                .map((e) => (
                  <GradeRow key={e.activity.id} event={e} />
                ))}
              {g.unplaced.map(({ topic, planned }) => (
                <li key={planned.id} className="flex items-start gap-3 px-3 py-2 text-sm text-muted-foreground">
                  <span className="w-24 shrink-0 italic">da collocare</span>
                  {createElement(isMinor(planned) ? MinorGradeIcon : GRADE_ICONS[planned.type], { className: 'mt-0.5 size-4 shrink-0' })}
                  <span className="min-w-0 flex-1">
                    {assessmentLabel(planned)} · {topic.title}
                    {planned.text && ` · ${planned.text}`}
                  </span>
                </li>
              ))}
              {Array.from({ length: toPlan }, (_, i) => (
                <li key={`m${i}`} className="px-3 py-2 text-sm text-muted-foreground italic">
                  Voto ancora da pianificare
                </li>
              ))}
              {g.full.length + g.minor.length + g.unplaced.length + toPlan === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">Niente in programma.</li>
              )}
            </ul>
            {(g.unplaced.length > 0 || toPlan > 0) && (
              <p className="text-xs text-muted-foreground">Nel Piano, <em>Proponi piano</em> mette in calendario quello che manca.</p>
            )}
          </Section>
        )
      })}
    </div>
  )
}

function GradeRow({ event }: { event: GradeEvent }) {
  const { data } = useData()
  const topics = event.activity.topicIds.map((id) => data.topics[id]?.title).filter(Boolean)
  const detail = [topics.join(', '), event.activity.text].filter(Boolean).join(' · ')
  return (
    <li className="flex items-start gap-3 px-3 py-2 text-sm">
      <span className="w-24 shrink-0 text-muted-foreground tabular-nums">{event.date ? formatShort(event.date) : 'già fatto'}</span>
      {createElement(isMinor(event) ? MinorGradeIcon : GRADE_ICONS[event.type], { className: 'mt-0.5 size-4 shrink-0 text-pencil-red' })}
      <span className="min-w-0 flex-1">
        <span className="font-medium">{assessmentLabel(event)}</span>
        {detail && <span className="text-muted-foreground"> · {detail}</span>}
      </span>
      {event.done && <DoneIcon className="size-4 shrink-0 text-done" aria-label="Fatto" />}
    </li>
  )
}
