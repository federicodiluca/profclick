import { useRef } from 'react'
import { CheckboxIcon, PinIcon, TrashIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { deleteNote, saveNote } from '@/core/actions'
import { sortedCourses } from '@/core/calendar'
import { courseColor } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { useAutosave } from '@/lib/useAutosave'
import { useData } from '@/state/data'

/**
 * Una nota da scrivere: titolo, testo e, se si vuole, le classi di cui parla. Tutto si salva
 * mentre si scrive; una nota lasciata vuota sparisce chiudendo.
 */
export function NoteDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, apply } = useData()
  const note = id ? data.notes[id] : undefined
  const close = () => {
    flushTyping()
    // La nota appena creata e lasciata vuota non resta in bacheca.
    apply((d) => {
      const latest = id ? d.notes[id] : undefined
      return latest && !latest.title.trim() && !latest.text.trim() ? deleteNote(latest.id)(d) : d
    })
    onClose()
  }
  return (
    <Dialog open={Boolean(note)} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">{note && <NoteForm key={note.id} id={note.id} onClose={onClose} />}</DialogContent>
    </Dialog>
  )
}

/** Esce dal campo in cui si scrive: il testo non ancora salvato si salva adesso (useAutosave). */
function flushTyping() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
}

function NoteForm({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, apply, applyWithUndo } = useData()
  const note = data.notes[id]
  const textRef = useRef<HTMLTextAreaElement>(null)
  const title = useAutosave((value) => note && value !== note.title && apply(saveNote({ ...note, title: value })))
  const text = useAutosave((value) => note && value !== note.text && apply(saveNote({ ...note, text: value })))
  if (!note) return null
  const courses = sortedCourses(data)

  /** Mette "[ ] " all'inizio della riga del cursore, o lo toglie se c'è già. */
  const toggleCheckbox = () => {
    const el = textRef.current
    if (!el) return
    const start = el.value.lastIndexOf('\n', el.selectionStart - 1) + 1
    const line = el.value.slice(start)
    const has = /^\[[ xX]\] ?/.exec(line)
    const cursor = el.selectionStart
    el.setRangeText(has ? '' : '[ ] ', start, start + (has ? has[0].length : 0), 'preserve')
    const moved = has ? Math.max(start, cursor - has[0].length) : cursor + 4
    el.focus()
    el.setSelectionRange(moved, moved)
    text.onChange({ target: el } as never)
  }

  const toggleCourse = (courseId: string) =>
    apply(saveNote({ ...note, courseIds: note.courseIds.includes(courseId) ? note.courseIds.filter((c) => c !== courseId) : [...note.courseIds, courseId] }))

  return (
    <>
      <DialogHeader>
        <DialogTitle className="sr-only">{note.title || 'Nuova nota'}</DialogTitle>
        <DialogDescription className="sr-only">Si salva da sola mentre scrivi.</DialogDescription>
        <Input
          defaultValue={note.title}
          placeholder="Titolo"
          aria-label="Titolo"
          autoFocus={!note.title}
          className="h-10 border-0 px-0 font-heading text-lg font-semibold shadow-none focus-visible:ring-0"
          {...title}
        />
      </DialogHeader>

      <div className="space-y-1.5">
        <Textarea
          ref={textRef}
          defaultValue={note.text}
          rows={10}
          placeholder={'Scrivi quello che vuoi.\n- una riga con il trattino è un elenco\n[ ] una con le parentesi si spunta'}
          aria-label="Testo della nota"
          autoFocus={Boolean(note.title)}
          onKeyDown={(e) => {
            // A capo dopo una casella o una voce di elenco, la riga nuova continua l'elenco.
            if (e.key !== 'Enter' || e.shiftKey) return
            const el = e.currentTarget
            const start = el.value.lastIndexOf('\n', el.selectionStart - 1) + 1
            const line = el.value.slice(start, el.selectionStart)
            const marker = /^(\s*(?:[-*•]\s+)?\[[ xX]\]\s?|\s*[-*•]\s+)/.exec(line)?.[0]
            if (!marker) return
            e.preventDefault()
            if (line === marker) {
              // Riga vuota: l'elenco finisce.
              el.setRangeText('', start, el.selectionStart, 'end')
            } else {
              el.setRangeText(`\n${marker.replace(/\[[xX]\]/, '[ ]')}`, el.selectionStart, el.selectionEnd, 'end')
            }
            text.onChange({ target: el } as never)
          }}
          {...text}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            <code>[ ]</code> casella · <code>-</code> elenco · <code>**grassetto**</code> · i link si aprono
          </p>
          <Button type="button" variant="outline" size="sm" onClick={toggleCheckbox}>
            <CheckboxIcon /> Casella
          </Button>
        </div>
      </div>

      {courses.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Classi</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Classi della nota">
            {courses.map((c) => {
              const on = note.courseIds.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleCourse(c.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    on ? 'bg-card text-foreground shadow-xs' : 'border-dashed text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className="size-2.5 shrink-0 rounded-full border-2" style={{ borderColor: courseColor(c), background: on ? courseColor(c) : 'transparent' }} />
                  {c.className}
                  {c.subject && <span className="text-muted-foreground">{c.subject}</span>}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">La nota compare anche negli Appunti di queste classi.</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <Button type="button" variant={note.pinned ? 'secondary' : 'ghost'} size="sm" aria-pressed={note.pinned} onClick={() => apply(saveNote({ ...note, pinned: !note.pinned }))}>
          <PinIcon /> {note.pinned ? 'Fissata in cima' : 'Fissa in cima'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            flushTyping()
            onClose()
            applyWithUndo(deleteNote(note.id), note.title.trim() ? `"${note.title.trim()}" eliminata` : 'Nota eliminata')
          }}
        >
          <TrashIcon /> Elimina
        </Button>
      </div>
    </>
  )
}
