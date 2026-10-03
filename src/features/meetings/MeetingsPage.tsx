import { useState } from 'react'
import { MeetingIcon, PlusIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { formatLong, today } from '@/core/dates'
import { pendingAfter, sortedMeetings } from '@/core/meetings'
import { type Meeting, meetingLabel } from '@/core/model'
import { cn } from '@/lib/utils'
import { useData } from '@/state/data'
import { MeetingDialog } from './MeetingDialog'

/**
 * Consigli, scrutini, collegi e corsi: quelli che arrivano, quelli passati con ancora qualcosa da
 * fare dopo (il verbale) e, a richiesta, gli altri passati.
 */
export default function MeetingsPage() {
  const { data } = useData()
  const now = today()
  const [open, setOpen] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)
  const all = sortedMeetings(data)
  const toFinish = all.filter((m) => m.date < now && pendingAfter(m).length > 0)
  const upcoming = all.filter((m) => m.date >= now)
  const past = all.filter((m) => m.date < now && !toFinish.includes(m)).reverse()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">Riunioni</h1>
        <Button onClick={() => setOpen('new')}>
          <PlusIcon /> Nuova riunione
        </Button>
      </div>

      {toFinish.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Da completare</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {toFinish.map((m) => (
              <MeetingCard key={m.id} meeting={m} showDate past onOpen={() => setOpen(m.id)} />
            ))}
          </div>
        </section>
      )}

      {upcoming.length === 0 ? (
        <p className="text-muted-foreground">
          Consigli di classe, scrutini, GLO, collegi, dipartimenti e corsi, con le cose da preparare: compaiono nella settimana e nel Da preparare
          quando si avvicinano. Per consigli e scrutini trovi già la situazione della classe con i voti e il programma.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {upcoming.map((m) => (
            <MeetingCard key={m.id} meeting={m} showDate onOpen={() => setOpen(m.id)} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => setShowPast(!showPast)}>
            {showPast ? 'Nascondi le passate' : `Mostra le passate (${past.length})`}
          </Button>
          {showPast && (
            <div className="grid gap-2 sm:grid-cols-2">
              {past.map((m) => (
                <MeetingCard key={m.id} meeting={m} showDate past onOpen={() => setOpen(m.id)} />
              ))}
            </div>
          )}
        </section>
      )}

      <MeetingDialog open={open} onClose={() => setOpen(null)} />
    </div>
  )
}

export function MeetingCard({ meeting, showDate, past, onOpen }: { meeting: Meeting; showDate?: boolean; past?: boolean; onOpen: () => void }) {
  const items = meeting.prep.filter((p) => p.text.trim() && !p.after)
  const ready = items.filter((p) => p.done).length
  const after = pendingAfter(meeting)
  const when = [showDate && formatLong(meeting.date), meeting.time && `ore ${meeting.time}`].filter(Boolean).join(' · ')

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn('flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-xs transition-colors hover:bg-muted/40', past && after.length === 0 && 'opacity-70')}
    >
      <MeetingIcon className="size-5 shrink-0 text-pencil-blue" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{meetingLabel(meeting)}</span>
        {when && <span className="block text-xs text-muted-foreground first-letter:uppercase">{when}</span>}
      </span>
      {past && after.length > 0 ? (
        <span className="max-w-40 shrink-0 truncate text-xs font-medium text-warn">{after.length === 1 ? after[0].text : `${after.length} cose da fare`}</span>
      ) : (
        items.length > 0 &&
        !past && (
          <span className={cn('shrink-0 text-xs', ready === items.length ? 'text-done' : 'text-warn')}>
            {ready}/{items.length} pronte
          </span>
        )
      )}
    </button>
  )
}
