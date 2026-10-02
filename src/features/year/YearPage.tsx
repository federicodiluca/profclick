import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Section } from '@/components/bits'
import { ShareApp } from '@/components/ShareApp'
import { CalendarAddIcon, CopyIcon, DownloadIcon, GoogleIcon, PlusIcon, TrashIcon, UploadIcon } from '@/components/icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteArchivedYear, deleteCourse, deleteMeeting, setYear, startNewYear } from '@/core/actions'
import { archivedProgram, nextSchoolYear } from '@/core/archive'
import type { ProgramTextInput } from '@/core/programText'
import { ProgramTextDialog } from '@/features/course/ProgramTextDialog'
import { allAssessments, allMeetings, toIcs } from '@/core/calendarExport'
import { addDays, formatDay, today } from '@/core/dates'
import { normalizeData, type SchoolYear } from '@/core/model'
import { PERIOD_PRESETS, type PeriodPreset, presetPeriods } from '@/core/schoolYear'
import { newId } from '@/lib/id'
import { cn } from '@/lib/utils'
import { useAuth } from '@/state/auth'
import { useData } from '@/state/data'

export default function YearPage() {
  const { data, apply, applyWithUndo } = useData()
  const year = data.year!
  const update = (patch: Partial<SchoolYear>) => apply(setYear({ ...year, ...patch }))
  const demoCourses = Object.keys(data.courses).filter((id) => id.startsWith('demo-'))
  const demoMeetings = Object.keys(data.meetings).filter((id) => id.startsWith('demo-'))
  // Il passaggio all'anno nuovo compare negli ultimi due mesi e, finite le lezioni, va in cima.
  const over = today() > year.end
  const ending = today() >= addDays(year.end, -60)

  return (
    <div className="space-y-10">
      <h1 className="font-heading text-2xl font-bold">Anno scolastico {year.label}</h1>

      {over && <NewYearSection />}

      <Section title="Inizio e fine delle lezioni">
        <div className="grid max-w-md grid-cols-2 gap-3">
          <DateField label="Primo giorno" value={year.start} onChange={(start) => update({ start, periods: year.periods.map((p, i) => (i === 0 ? { ...p, start } : p)) })} />
          <DateField
            label="Ultimo giorno"
            value={year.end}
            onChange={(end) => update({ end, periods: year.periods.map((p, i) => (i === year.periods.length - 1 ? { ...p, end } : p)) })}
          />
        </div>
      </Section>

      <Section
        title="Periodi"
        action={
          <div className="flex flex-wrap gap-1">
            {(Object.keys(PERIOD_PRESETS) as PeriodPreset[]).map((preset) => (
              <Button
                key={preset}
                variant="outline"
                size="sm"
                onClick={() => applyWithUndo(setYear({ ...year, periods: presetPeriods(preset, year.start, year.end) }), `Periodi: ${PERIOD_PRESETS[preset].toLowerCase()}`)}
              >
                {PERIOD_PRESETS[preset]}
              </Button>
            ))}
          </div>
        }
      >
        <div className="space-y-2">
          {year.periods.map((p, i) => (
            <div key={p.id} className="grid grid-cols-2 items-end gap-2 border-b pb-3 last:border-0 sm:grid-cols-[1fr_auto_auto] sm:border-0 sm:pb-0">
              <TextField className="col-span-2 sm:col-span-1" label="Nome" value={p.name} onChange={(name) => update({ periods: year.periods.map((x, j) => (j === i ? { ...x, name } : x)) })} />
              <DateField label="Dal" value={p.start} onChange={(start) => update({ periods: year.periods.map((x, j) => (j === i ? { ...x, start } : x)) })} />
              <DateField label="Al" value={p.end} onChange={(end) => update({ periods: year.periods.map((x, j) => (j === i ? { ...x, end } : x)) })} />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Vacanze e festività"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => update({ holidays: [...year.holidays, { id: newId(), name: 'Ponte', from: year.start, to: year.start }] })}
          >
            <PlusIcon /> Aggiungi
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">
          Ci sono già le festività nazionali. Controlla le date con il calendario della tua regione e aggiungi quelle della tua scuola, come il santo
          patrono e i ponti: nei giorni qui sotto non ci sono lezioni.
        </p>
        <div className="space-y-2">
          {[...year.holidays]
            .sort((a, b) => (a.from < b.from ? -1 : 1))
            .map((h) => (
              <div key={h.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 border-b pb-3 last:border-0 sm:grid-cols-[1fr_auto_auto_auto] sm:border-0 sm:pb-0">
                <TextField className="col-span-3 sm:col-span-1" label="Nome" value={h.name} onChange={(name) => update({ holidays: year.holidays.map((x) => (x.id === h.id ? { ...x, name } : x)) })} />
                <DateField label="Dal" value={h.from} onChange={(from) => update({ holidays: year.holidays.map((x) => (x.id === h.id ? { ...x, from, to: x.to < from ? from : x.to } : x)) })} />
                <DateField label="Al" value={h.to} onChange={(to) => update({ holidays: year.holidays.map((x) => (x.id === h.id ? { ...x, to } : x)) })} />
                <Button variant="ghost" size="icon" aria-label={`Togli ${h.name}`} onClick={() => applyWithUndo(setYear({ ...year, holidays: year.holidays.filter((x) => x.id !== h.id) }), `Tolto dal calendario: ${h.name}`)}>
                  <TrashIcon />
                </Button>
              </div>
            ))}
        </div>
      </Section>

      {ending && !over && <NewYearSection />}

      <PastYearsSection />

      <DriveSection />

      <CalendarSection />

      <BackupSection />

      {demoCourses.length > 0 && (
        <Section title="Dati di esempio">
          <p className="text-sm text-muted-foreground">Le classi di esempio servono solo a provare. Quando sei pronto, toglile e aggiungi le tue.</p>
          <Button variant="destructive" onClick={() => applyWithUndo(
                (d) => demoMeetings.reduce((x, id) => deleteMeeting(id)(x), demoCourses.reduce((x, id) => deleteCourse(id)(x), d)),
                'Classi di esempio rimosse',
              )}>
            <TrashIcon /> Rimuovi le classi di esempio
          </Button>
        </Section>
      )}

      <footer className="border-t pt-6 text-sm text-muted-foreground">
        ProfClick è ideato e sviluppato da{' '}
        <a href="https://federicodiluca.com/" className="font-medium text-foreground underline-offset-4 hover:underline">
          Federico Di Luca
        </a>
        , sviluppatore e docente. <a href="/privacy/" className="underline-offset-4 hover:underline">Privacy</a>
        {' · '}
        <ShareApp className="underline-offset-4 hover:underline" />
      </footer>
    </div>
  )
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
      {label}
      <Input type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="w-full sm:w-[9.5rem]" />
    </label>
  )
}

function TextField({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={cn('grid min-w-0 gap-1 text-xs text-muted-foreground', className)}>
      {label}
      <Input key={value} defaultValue={value} onBlur={(e) => e.target.value.trim() && e.target.value !== value && onChange(e.target.value.trim())} />
    </label>
  )
}

function DriveSection() {
  const { token, available, linked, signIn, signingIn, unlink } = useAuth()
  const { sync } = useData()
  if (!available) return null
  return (
    <Section title="Google Drive">
      <p className="text-sm text-muted-foreground">
        Con Google Drive hai gli stessi dati su PC, tablet e telefono. ProfClick salva un solo file, <code>profclick-dati.json</code>, e non vede
        nient'altro del tuo Drive. Se modifichi da due dispositivi, anche offline, le modifiche si uniscono da sole.
      </p>
      {token ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">
            Collegato{sync.state === 'synced' && `: ultimo salvataggio alle ${sync.at.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
          </span>
          <Button variant="ghost" size="sm" onClick={unlink}>
            Scollega
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => void signIn()} disabled={signingIn}>
          <GoogleIcon /> {linked ? 'Sincronizza con Google Drive' : 'Collega Google Drive'}
        </Button>
      )}
    </Section>
  )
}

/** Tutte le verifiche e le riunioni in un file .ics, da importare in Google Calendar (ADR 0009, 0011). */
function CalendarSection() {
  const { data } = useData()
  const assessments = allAssessments(data)
  const meetings = allMeetings(data)
  const entries = [...assessments, ...meetings]
  if (entries.length === 0) return null

  const download = () => {
    const blob = new Blob([toIcs(entries, new Date())], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'profclick.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Section title="Verifiche e riunioni sul calendario">
      <p className="text-sm text-muted-foreground">
        {assessments.length === 1 ? 'La valutazione' : `Le ${assessments.length} valutazioni`} in programma, come eventi di un giorno intero
        {meetings.length > 0 && `, e ${meetings.length === 1 ? 'la riunione' : `le ${meetings.length} riunioni`}, all'ora indicata`}. In Google
        Calendar: Impostazioni, Importa. Importandolo di nuovo dopo aver cambiato il piano, gli eventi si aggiornano invece di duplicarsi. Per una
        sola verifica o riunione c'è <em>Aggiungi a Google Calendar</em> nella lezione o nella riunione.
      </p>
      <Button variant="outline" onClick={download}>
        <CalendarAddIcon /> Scarica il calendario (.ics)
      </Button>
    </Section>
  )
}

/** Fine anno: classi e programmi nell'archivio, si riparte dall'anno dopo (ADR 0012). */
function NewYearSection() {
  const { data, applyWithUndo } = useData()
  const [confirm, setConfirm] = useState(false)
  const year = data.year!
  const next = nextSchoolYear(year)
  const courses = Object.keys(data.courses).length

  return (
    <Section title={`Passa al ${next.label}`}>
      <p className="text-sm text-muted-foreground">
        A fine anno. Le classi di quest'anno, con il loro programma, vanno tra gli anni precedenti: nelle classi nuove lo copi con un tocco dal
        Programma. Lezioni, verifiche e riunioni di quest'anno si tolgono; se vuoi tenerle, scarica prima la copia di sicurezza qui sotto.
      </p>
      <Button variant="outline" onClick={() => setConfirm(true)}>
        <PlusIcon /> Inizia il {next.label}
      </Button>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniziare il {next.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {courses === 1 ? 'La classe' : `Le ${courses} classi`} del {year.label} {courses === 1 ? 'va' : 'vanno'} tra gli anni precedenti con il
              programma. Lezioni, verifiche e riunioni si tolgono. Il nuovo anno parte con le festività nazionali: poi aggiungi quelle della tua regione
              e le classi nuove.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => applyWithUndo(startNewYear(next), `Benvenuto nel ${next.label}`)}>Inizia il {next.label}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  )
}

/** Gli anni archiviati: i loro programmi si copiano nelle classi nuove. */
function PastYearsSection() {
  const { data, applyWithUndo } = useData()
  const [text, setText] = useState<ProgramTextInput | null>(null)
  const years = Object.values(data.archive).sort((a, b) => b.label.localeCompare(a.label))
  if (years.length === 0) return null

  return (
    <Section title="Anni precedenti">
      <p className="text-sm text-muted-foreground">
        I programmi delle classi passate: li copi in una classe nuova dal suo Programma. Il programma svolto di ognuna resta qui, da copiare come testo.
      </p>
      {years.map((y) => (
        <div key={y.label} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{y.label}</h3>
            <Button variant="ghost" size="icon-sm" aria-label={`Togli il ${y.label}`} onClick={() => applyWithUndo(deleteArchivedYear(y.label), `${y.label} tolto`)}>
              <TrashIcon />
            </Button>
          </div>
          <ul className="divide-y rounded-xl border bg-card">
            {y.courses.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Nessuna classe</li>}
            {y.courses.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                <span className="min-w-0 truncate">{c.subject ? `${c.className} · ${c.subject}` : c.className}</span>
                <Button variant="ghost" size="sm" onClick={() => setText(archivedProgram(y, c))}>
                  <CopyIcon /> Programma svolto
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <ProgramTextDialog input={text} onClose={() => setText(null)} />
    </Section>
  )
}

function BackupSection() {
  const { data, importData } = useData()
  const input = useRef<HTMLInputElement>(null)

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `profclick-${data.year?.label.replace('/', '-') ?? 'dati'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJson = async (file: File) => {
    try {
      importData(normalizeData(JSON.parse(await file.text())))
      toast.success('Backup importato e unito ai dati attuali')
    } catch {
      toast.error('Il file non è un backup di ProfClick')
    }
  }

  return (
    <Section title="Copia di sicurezza">
      <p className="text-sm text-muted-foreground">
        Un file con tutti i tuoi dati, da tenere dove vuoi. Importandolo, si unisce a quelli che hai già: non cancella niente.
        {data.year && ` Anno ${data.year.label}, dal ${formatDay(data.year.start)}.`}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportJson}>
          <DownloadIcon /> Scarica
        </Button>
        <Button variant="outline" onClick={() => input.current?.click()}>
          <UploadIcon /> Importa
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void importJson(file)
            e.target.value = ''
          }}
        />
      </div>
    </Section>
  )
}
