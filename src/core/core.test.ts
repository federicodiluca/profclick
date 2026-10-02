import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addActivity, cancelAndShift, changeSchedule, deleteCourse, deleteMeeting, saveCourse, saveMeeting, saveTopics, setDone, setYear, toggleMeetingPrep, undoTo } from './actions'
import { courseSlots, floatingSlotsOfWeek } from './calendar'
import { easter, startOfWeek, weekday } from './dates'
import { periodGrades, targetGrades } from './grading'
import { parseProgram } from './importText'
import { classSummary, defaultPrep, meetingPeriod, openMeetingPrep, summaryText, updateDefaultPrep, wasCoordinator } from './meetings'
import { mergeData, sameData } from './merge'
import { type Course, emptyData, lessonKey, type Meeting, meetingLabel, normalizeData, type ProfclickData, type Topic } from './model'
import { topicProgress } from './progress'
import { assessmentTypes, proposePlan } from './proposal'
import { sampleData } from './sample'
import { defaultSchoolYear } from './schoolYear'

const course: Omit<Course, 'updatedAt'> = {
  id: 'c1',
  className: '3A',
  subject: 'Informatica',
  color: 0,
  schedule: [
    { day: 1, hours: 2, lab: false },
    { day: 3, hours: 1, lab: false },
    { day: 5, hours: 2, lab: true },
  ],
  pastSchedules: [],
  rules: { perPeriod: null, required: ['scritto', 'teorico', 'pratico'], minorWeight: 50 },
  civics: {},
  prep: [],
  notes: '',
  order: 0,
}

const topic = (id: string, title: string, hours: number, extra: Partial<Topic> = {}): Omit<Topic, 'updatedAt'> => ({
  id,
  courseId: 'c1',
  title,
  hours,
  periodId: 'p1',
  points: [],
  assessments: [],
  completed: false,
  order: Number(id.slice(1)),
  ...extra,
})

function base(c: Omit<Course, 'updatedAt'> = course): ProfclickData {
  let data = setYear(defaultSchoolYear(2026))(emptyData())
  data = saveCourse(c)(data)
  return saveTopics([topic('t1', 'Algoritmi', 10), topic('t2', 'Array', 12)])(data)
}

const verifica = (id: string, type: 'scritto' | 'teorico' | 'pratico', weight = 100, continues = false) => ({
  id,
  kind: 'verifica' as const,
  topicIds: [],
  text: '',
  assessment: { type, weight, continues },
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-29T10:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('date', () => {
  it('calcola la Pasqua', () => {
    expect(easter(2027)).toBe('2027-03-28')
    expect(easter(2026)).toBe('2026-04-05')
  })
  it('giorni della settimana e lunedì', () => {
    expect(weekday('2026-09-28')).toBe(1)
    expect(weekday('2026-10-04')).toBe(7)
    expect(startOfWeek('2026-10-03')).toBe('2026-09-28')
  })
})

describe('anno scolastico e lezioni', () => {
  it('propone quadrimestri e salta le festività', () => {
    const year = defaultSchoolYear(2026)
    expect(year.start).toBe('2026-09-14')
    expect(year.periods.map((p) => p.end)).toEqual(['2027-01-31', '2027-06-08'])
    const data = base()
    const slots = courseSlots(data, data.courses.c1, '2026-12-21', '2027-01-10')
    // Lun 21, mer 23 è vacanza: restano lun 21 e poi niente fino all'8 gennaio (venerdì).
    expect(slots.map((s) => s.date)).toEqual(['2026-12-21', '2027-01-08'])
    expect(slots[1].lab).toBe(true)
  })

  it('senza giorni: le lezioni si mettono in ordine nella settimana', () => {
    const data = base({
      ...course,
      schedule: [
        { day: null, hours: 2, lab: true },
        { day: null, hours: 1, lab: false },
      ],
    })
    const week = floatingSlotsOfWeek(data, '2026-09-28')
    expect(week.map((s) => [s.index, s.hours, s.lab])).toEqual([
      [1, 2, true],
      [2, 1, false],
    ])
    // Una festività in settimana toglie una lezione: l'8 dicembre è martedì, la seconda.
    expect(floatingSlotsOfWeek(data, '2026-12-07').map((s) => s.index)).toEqual([1])
  })

  it('legge i dati delle prime versioni', () => {
    const old = { courses: { c: { id: 'c', schedule: { 1: 2, 4: 1 }, rules: {} } }, lessons: { x: { activities: [{ id: 'a', kind: 'verifica', assessment: { type: 'scritto', minor: true } }] } } }
    const data = normalizeData(old)
    expect(data.courses.c.schedule).toEqual([
      { day: 1, hours: 2, lab: false },
      { day: 4, hours: 1, lab: false },
    ])
    expect(data.lessons.x.activities[0].assessment).toEqual({ type: 'scritto', weight: 50, continues: false })
  })
})

describe('voti', () => {
  it('uno per ogni ora settimanale, almeno quanti i tipi richiesti', () => {
    expect(targetGrades({ ...course, updatedAt: 0 })).toBe(5)
    expect(targetGrades({ ...course, schedule: [{ day: 1, hours: 2, lab: false }], updatedAt: 0 })).toBe(3)
    expect(targetGrades({ ...course, rules: { ...course.rules, perPeriod: 4 }, updatedAt: 0 })).toBe(4)
  })

  it('conta le valutazioni piene, esclude minori e prosecuzioni', () => {
    let data = base()
    data = addActivity('c1', '2026-10-05', verifica('a', 'scritto'))(data)
    data = addActivity('c1', '2026-10-07', verifica('b', 'teorico'))(data)
    data = addActivity('c1', '2026-10-09', verifica('c', 'teorico', 100, true))(data)
    data = addActivity('c1', '2026-10-12', verifica('d', 'scritto', 30))(data)
    data = setDone('c1', '2026-10-05', true)(data)
    const g = periodGrades(data, data.courses.c1, data.year!.periods[0], '2026-09-29')
    expect(g.full).toHaveLength(2)
    expect(g.minor).toHaveLength(1)
    expect(g.done).toBe(1)
    expect(g.missing).toBe(3)
    expect(g.missingTypes).toEqual(['pratico'])
  })

  it('conta le ore di educazione civica', () => {
    let data = base({ ...course, civics: { p1: 3 } })
    data = addActivity('c1', '2026-10-05', { id: 'x', kind: 'civica', topicIds: [], text: '' })(data)
    const g = periodGrades(data, data.courses.c1, data.year!.periods[0], '2026-09-29')
    expect(g.civics).toEqual({ target: 3, planned: 2, done: 0 })
  })

  it('sceglie prima i tipi mancanti, poi a rotazione', () => {
    expect(assessmentTypes({ ...course, updatedAt: 0 }, ['scritto'], 4)).toEqual(['teorico', 'pratico', 'scritto', 'teorico'])
  })
})

describe('proposta di piano', () => {
  it('distribuisce argomenti e valutazioni nelle lezioni libere', () => {
    const data = base()
    const period = data.year!.periods[0]
    const p = proposePlan(data, data.courses.c1, period, '2026-09-29')
    const assessments = p.lessons.filter((l) => l.activity.kind === 'verifica')
    expect(assessments).toHaveLength(5)
    expect(new Set(assessments.map((a) => a.activity.assessment!.type))).toEqual(new Set(['scritto', 'teorico', 'pratico']))
    expect(p.overflowHours).toBe(0)
    expect(p.spareLessons).toBeGreaterThan(0)
    expect(assessments.at(-1)!.date < '2027-01-26').toBe(true)
    expect(assessments[0].activity.topicIds).toContain('t1')
  })

  it('usa le valutazioni previste per argomento, il pratico in laboratorio', () => {
    let data = base()
    data = saveTopics([
      topic('t1', 'Algoritmi', 4, { assessments: [{ id: 'v1', type: 'pratico', weight: 100, text: 'Flowgorithm', done: false }] }),
      topic('t2', 'Array', 4, { assessments: [{ id: 'v2', type: 'teorico', weight: 30, text: 'flipped', done: false }] }),
    ])(data)
    const p = proposePlan(data, data.courses.c1, data.year!.periods[0], '2026-09-29')
    const pratico = p.lessons.find((l) => l.activity.assessment?.plannedId === 'v1')!
    const slot = courseSlots(data, data.courses.c1, pratico.date, pratico.date)[0]
    expect(slot.lab).toBe(true)
    expect(pratico.activity.text).toBe('Flowgorithm')
    // Prima del pratico, se serve aspettare il laboratorio, c'è un ripasso.
    const minor = p.lessons.find((l) => l.activity.assessment?.plannedId === 'v2')!
    expect(minor.activity.assessment!.weight).toBe(30)
    expect(minor.date > pratico.date).toBe(true)
    // I voti pieni che mancano si aggiungono: 1 pratico previsto + 4 = 5.
    const full = p.lessons.filter((l) => l.activity.assessment && l.activity.assessment.weight >= 100)
    expect(full).toHaveLength(5)
  })

  it('mette in calendario le ore di educazione civica', () => {
    const data = base({ ...course, civics: { p1: 4 } })
    const p = proposePlan(data, data.courses.c1, data.year!.periods[0], '2026-09-29')
    const civic = p.lessons.filter((l) => l.activity.kind === 'civica')
    expect(civic.reduce((s, l) => s + l.hours, 0)).toBeGreaterThanOrEqual(4)
  })
})

describe('avanzamento', () => {
  it('somma le ore pianificate e fatte per argomento', () => {
    let data = base()
    data = addActivity('c1', '2026-10-05', { id: 'x', kind: 'spiegazione', topicIds: ['t1'], text: '' })(data)
    data = addActivity('c1', '2026-10-07', { id: 'y', kind: 'laboratorio', topicIds: ['t1'], text: '' })(data)
    data = setDone('c1', '2026-10-05', true)(data)
    const [t1, t2] = topicProgress(data, data.courses.c1)
    expect(t1.plannedHours).toBe(3)
    expect(t1.doneHours).toBe(2)
    expect(t1.status).toBe('in-corso')
    expect(t2.status).toBe('da-pianificare')
  })
})

describe('lezione persa', () => {
  it('annulla il giorno e fa slittare il piano', () => {
    let data = base()
    data = addActivity('c1', '2026-10-05', { id: 'a', kind: 'spiegazione', topicIds: ['t1'], text: '' })(data)
    data = addActivity('c1', '2026-10-07', { id: 'b', kind: 'spiegazione', topicIds: ['t2'], text: '' })(data)
    data = addActivity('c1', '2026-10-09', { id: 'c', kind: 'laboratorio', topicIds: ['t2'], text: '' })(data)
    data = cancelAndShift('c1', '2026-10-05')(data)
    expect(data.lessons[lessonKey('c1', '2026-10-05')].cancelled).toBe(true)
    expect(data.lessons[lessonKey('c1', '2026-10-07')].activities[0].id).toBe('a')
    expect(data.lessons[lessonKey('c1', '2026-10-09')].activities[0].id).toBe('b')
    expect(data.lessons[lessonKey('c1', '2026-10-12')].activities[0].id).toBe('c')
  })
})

describe('cambio di orario', () => {
  const spiegazione = (id: string) => ({ id, kind: 'spiegazione' as const, topicIds: ['t1'], text: '' })
  const tueThu = [
    { day: 2, hours: 2, lab: false },
    { day: 4, hours: 3, lab: true },
  ]

  it('le lezioni passate restano, il piano passa sui nuovi giorni in ordine', () => {
    let data = base()
    data = setDone('c1', '2026-09-28', true)(addActivity('c1', '2026-09-28', spiegazione('old'))(data))
    data = addActivity('c1', '2026-10-05', spiegazione('a'))(data)
    data = addActivity('c1', '2026-10-07', spiegazione('b'))(data)
    data = addActivity('c1', '2026-10-09', spiegazione('c'))(data)
    data = changeSchedule('c1', tueThu, '2026-10-05')(data)

    const c = data.courses.c1
    expect(c.pastSchedules).toEqual([{ until: '2026-10-04', schedule: course.schedule }])
    expect(courseSlots(data, c, '2026-09-28', '2026-10-04').map((s) => s.date)).toEqual(['2026-09-28', '2026-09-30', '2026-10-02'])
    expect(data.lessons[lessonKey('c1', '2026-09-28')].activities[0].id).toBe('old')
    expect(courseSlots(data, c, '2026-10-05', '2026-10-13').map((s) => [s.date, s.lesson?.activities[0]?.id])).toEqual([
      ['2026-10-06', 'a'],
      ['2026-10-08', 'b'],
      ['2026-10-13', 'c'],
    ])
    expect(data.lessons[lessonKey('c1', '2026-10-05')]).toBeUndefined()
  })

  it("dall'inizio dell'anno corregge tutto, e due orari uguali di seguito sono uno", () => {
    let data = changeSchedule('c1', tueThu, '2026-10-05')(base())
    data = changeSchedule('c1', tueThu, '2026-09-21')(data)
    expect(data.courses.c1.pastSchedules.map((p) => p.until)).toEqual(['2026-09-20'])
    data = changeSchedule('c1', course.schedule, data.year!.start)(data)
    expect(data.courses.c1.pastSchedules).toEqual([])
  })
})

describe('spuntato nel programma', () => {
  it('una valutazione fatta senza lezione conta; quelle degli argomenti conclusi restano da collocare', () => {
    let data = base()
    data = saveTopics([
      topic('t1', 'Algoritmi', 4, { assessments: [{ id: 'v1', type: 'scritto', weight: 100, text: '', done: true }] }),
      topic('t2', 'Array', 4, { completed: true, assessments: [{ id: 'v2', type: 'pratico', weight: 100, text: '', done: false }] }),
    ])(data)
    const g = periodGrades(data, data.courses.c1, data.year!.periods[0], '2026-09-29')
    expect(g.full.map((e) => [e.date, e.type, e.done])).toEqual([[null, 'scritto', true]])
    expect(g.done).toBe(1)
    expect(g.missingTypes).not.toContain('scritto')
    expect(g.unplaced.map((u) => u.planned.id)).toEqual(['v2'])
    const p = proposePlan(data, data.courses.c1, data.year!.periods[0], '2026-09-29')
    expect(p.lessons.some((l) => l.activity.assessment?.plannedId === 'v2')).toBe(true)
    expect(p.lessons.some((l) => l.activity.kind === 'spiegazione' && l.activity.topicIds.includes('t2'))).toBe(false)
  })

  it('nei dati di prima, le valutazioni di un argomento concluso sono fatte', () => {
    const data = normalizeData({ topics: { t: { id: 't', completed: true, assessments: [{ id: 'v', type: 'scritto', weight: 100, text: '' }] } } })
    expect(data.topics.t.assessments[0].done).toBe(true)
    expect(normalizeData({ courses: { c: { id: 'c', schedule: [] } } }).courses.c.pastSchedules).toEqual([])
  })
})

describe('unione tra dispositivi', () => {
  it('tiene la modifica più recente di ogni record', () => {
    const start = base()
    vi.setSystemTime(new Date('2026-09-29T11:00:00Z'))
    const phone = addActivity('c1', '2026-10-05', { id: 'p', kind: 'spiegazione', topicIds: ['t1'], text: '' })(start)
    vi.setSystemTime(new Date('2026-09-29T12:00:00Z'))
    const pc = addActivity('c1', '2026-10-07', { id: 'q', kind: 'ripasso', topicIds: [], text: '' })(start)
    const merged = mergeData(phone, pc)
    expect(Object.keys(merged.lessons).sort()).toEqual([lessonKey('c1', '2026-10-05'), lessonKey('c1', '2026-10-07')])
    expect(sameData(merged, mergeData(pc, phone))).toBe(true)
  })

  it('una cancellazione più recente vince', () => {
    const start = base()
    vi.setSystemTime(new Date('2026-09-29T11:00:00Z'))
    const removed = deleteCourse('c1')(start)
    const merged = mergeData(start, removed)
    expect(merged.courses.c1).toBeUndefined()
    expect(Object.keys(merged.topics)).toHaveLength(0)
  })
})

describe('annulla', () => {
  it('rimette i record com erano, anche quelli cancellati', () => {
    const before = base()
    vi.setSystemTime(new Date('2026-09-29T11:00:00Z'))
    let data = deleteCourse('c1')(before)
    data = addActivity('c2', '2026-10-05', { id: 'z', kind: 'altro', topicIds: [], text: '' })(data)
    vi.setSystemTime(new Date('2026-09-29T11:00:01Z'))
    const undone = undoTo(before)(data)
    expect(undone.courses.c1.className).toBe('3A')
    expect(Object.keys(undone.topics)).toHaveLength(2)
    expect(Object.keys(undone.lessons)).toHaveLength(0)
    expect(mergeData(data, undone).courses.c1).toBeDefined()
  })
})

describe('importazione del programma', () => {
  it('legge argomenti, sotto-punti, ore e caselle', () => {
    const text = ['☑ Algoritmi (10h)', '  ☐ Flowgorithm', '☐ Array - 12 ore', '   ricerca e ordinamento', '☐ Funzioni'].join('\n')
    expect(parseProgram(text).map((t) => [t.title, t.hours, t.points, t.completed])).toEqual([
      ['Algoritmi', 10, ['Flowgorithm'], true],
      ['Array', 12, ['ricerca e ordinamento'], false],
      ['Funzioni', null, [], false],
    ])
  })

  it('con elenchi misti, il trattino indica un sotto-punto', () => {
    expect(parseProgram('Reti\n- ISO/OSI\n- TCP/IP\nDatabase: 20h').map((t) => [t.title, t.points, t.hours])).toEqual([
      ['Reti', ['ISO/OSI', 'TCP/IP'], null],
      ['Database', [], 20],
    ])
  })

  it("legge l'elenco dei voti di Keep: periodi, pesi, tipi, argomenti ripetuti", () => {
    const note = [
      'VOTI',
      '1️⃣ Codifica delle informazioni (orale) ⬅️',
      '1️⃣ Codifica delle informazioni (pratico)',
      '1️⃣ Trasmissione delle informazioni (scritto)',
      '',
      '2️⃣ Sistemi operativi (scritto)',
      '✳️ Flipped Classroom (orale, 30%)',
      '2️⃣ Progetto (pratico con orale, 75%)',
      '❌ C e C++',
      '2️⃣ Socket (?)',
      '2️⃣ Prova parallela (scritto)',
    ].join('\n')
    const topics = parseProgram(note)
    expect(topics.map((t) => [t.title, t.period, t.hours])).toEqual([
      ['Codifica delle informazioni', 1, null],
      ['Trasmissione delle informazioni', 1, null],
      ['Sistemi operativi', 2, null],
      ['Flipped Classroom', 2, null],
      ['Progetto', 2, null],
      ['C e C++', 2, null],
      ['Socket', 2, null],
      ['Prova parallela', 2, 0],
    ])
    expect(topics[0].assessments.map((a) => a.type)).toEqual(['teorico', 'pratico'])
    expect(topics[3].assessments[0]).toEqual({ type: 'teorico', weight: 30, minor: true, text: '' })
    expect(topics[4].assessments[0]).toEqual({ type: 'pratico', weight: 75, minor: true, text: 'con orale' })
    // ❌ è un vecchio segno, non vuol dire "tolto": la riga resta.
    expect(topics[5].assessments[0].type).toBe('scritto')
    expect(topics[6].assessments[0].type).toBe('scritto')
    expect(topics.every((t) => !t.completed)).toBe(true)
  })

  it('legge la lista NEXT: valutazioni sugli argomenti sopra, ⬅️ come punto raggiunto', () => {
    const note = [
      '- Lunedì (2h): HTML',
      '- Martedì (1h): -',
      '',
      'NEXT:',
      '⚠️ Scritto ❓',
      '- HTML e CSS',
      '⚠️ Pratico con orale',
      '- Sistemi posizionali ⬅️',
      '- Conversioni di numeri reali e tra basi',
      '- Attività ❓',
      '- Immagini suoni e video',
      '⚠️ Scritto ❓',
      '',
      '- Codici pesati',
      '...',
    ].join('\n')
    const topics = parseProgram(note)
    expect(topics.map((t) => [t.title, t.completed, t.assessments.map((a) => `${a.type}${a.minor ? '*' : ''}${a.text ? ` ${a.text}` : ''}`)])).toEqual([
      ['Verifica', true, ['scritto']],
      ['HTML e CSS', true, ['pratico con orale']],
      ['Sistemi posizionali', false, []],
      ['Conversioni di numeri reali e tra basi', false, ['pratico*']],
      ['Immagini suoni e video', false, ['scritto']],
      ['Codici pesati', false, []],
    ])
  })
})

describe('dati di esempio', () => {
  it('si generano con un piano e lezioni passate fatte', () => {
    const data = sampleData('2026-11-10')
    expect(Object.keys(data.courses)).toHaveLength(2)
    const lessons = Object.values(data.lessons)
    expect(lessons.some((l) => l.done)).toBe(true)
    expect(lessons.some((l) => !l.done)).toBe(true)
    // Le valutazioni previste finiscono tutte in calendario.
    for (const c of Object.values(data.courses)) {
      for (const p of data.year!.periods) expect(periodGrades(data, c, p, '2026-09-14').unplaced).toEqual([])
    }
  })
})

describe('calendario', () => {
  it('collegamento a Google Calendar e file ics', async () => {
    const { allAssessments, googleCalendarLink, toIcs } = await import('./calendarExport')
    let data = base()
    data = addActivity('c1', '2026-10-05', { ...verifica('v', 'scritto'), topicIds: ['t1'] })(data)
    const [entry] = allAssessments(data)
    expect(entry.title).toBe('Verifica scritta 3A: Algoritmi')
    expect(googleCalendarLink(entry)).toContain('dates=20261005%2F20261006')
    const ics = toIcs([entry], new Date('2026-09-29T10:00:00Z'))
    expect(ics).toContain('DTSTART;VALUE=DATE:20261005')
    expect(ics).toContain('UID:v@profclick.federicodiluca.com')
  })
})

describe('importazione: blocchi', () => {
  it('un voto minore a inizio blocco prende il periodo del blocco', () => {
    const note = ['1️⃣ Aziende e Mercati (orale) ⬅️', '✳️ Marketing (pratico, 20%)', '1️⃣ Organizzazione Aziendale (scritto)', '', '✳️ Intro PM (orale, 30%)', '2️⃣ PM nei Progetti Informatici (scritto)'].join('\n')
    expect(parseProgram(note).map((t) => [t.title, t.period])).toEqual([
      ['Aziende e Mercati', 1],
      ['Marketing', 1],
      ['Organizzazione Aziendale', 1],
      ['Intro PM', 2],
      ['PM nei Progetti Informatici', 2],
    ])
  })
})

describe('importazione: dettagli', () => {
  it('tiene quello che resta tra parentesi', () => {
    const [a, b, c] = parseProgram('✳️ Stima Costi (orale, 70% con domande)\n2️⃣ Progetto (pratico con orale, 75%)\n2️⃣ Reti (scritto)').map((t) => t.assessments[0])
    expect([a.type, a.weight, a.text]).toEqual(['teorico', 70, 'con domande'])
    expect([b.type, b.weight, b.text]).toEqual(['pratico', 75, 'con orale'])
    expect(c.text).toBe('')
  })
})

const meeting = (id: string, extra: Partial<Meeting> = {}): Omit<Meeting, 'updatedAt'> => ({
  id,
  kind: 'cdc',
  date: '2026-10-20',
  time: '15:00',
  className: '3A',
  title: '',
  coordinator: false,
  prep: [],
  notes: '',
  ...extra,
})

describe('riunioni', () => {
  it('nomi, cose da preparare proposte e coordinatore', () => {
    let n = 0
    const id = () => `x${n++}`
    expect(meetingLabel(meeting('m'))).toBe('Consiglio di classe 3A')
    expect(meetingLabel(meeting('m', { kind: 'corso', title: 'Corso sicurezza', className: null }))).toBe('Corso sicurezza')
    const prep = defaultPrep('scrutinio', false, id)
    expect(prep.map((p) => p.text)).toEqual(['Proposte di voto sul registro', 'Argomenti da recuperare per le insufficienze'])
    // Diventando coordinatore si aggiungono le sue voci; quelle scritte a mano restano.
    const mine = [...prep, { id: 'mia', text: 'Mia', done: false }]
    const coord = updateDefaultPrep(mine, { kind: 'scrutinio', coordinator: false }, { kind: 'scrutinio', coordinator: true }, id)
    expect(coord.map((p) => p.text)).toContain('Giudizi e verbale')
    expect(coord.map((p) => p.text)).toContain('Mia')
    const back = updateDefaultPrep(coord, { kind: 'scrutinio', coordinator: true }, { kind: 'collegio', coordinator: false }, id)
    expect(back.map((p) => p.text)).toEqual(['Leggere i documenti della convocazione', 'Mia'])

    let data = saveMeeting(meeting('a', { coordinator: true, date: '2026-10-20' }))(base())
    data = saveMeeting(meeting('b', { kind: 'collegio', className: null, date: '2026-11-20' }))(data)
    expect(wasCoordinator(data, '3A')).toBe(true)
    expect(wasCoordinator(data, '4B')).toBe(false)
  })

  it('le cose da preparare scadono il giorno della riunione', () => {
    let data = saveMeeting(meeting('a', { prep: [{ id: 'p', text: 'Verbale', done: false }] }))(base())
    data = saveMeeting(meeting('old', { date: '2026-09-20', prep: [{ id: 'q', text: 'Vecchia', done: false }] }))(data)
    expect(openMeetingPrep(data, '2026-09-29').map((p) => [p.item.text, p.due])).toEqual([['Verbale', '2026-10-20']])
    data = toggleMeetingPrep('a', 'p')(data)
    expect(openMeetingPrep(data, '2026-09-29')).toEqual([])
  })

  it('lo scrutinio guarda il periodo appena finito', () => {
    const year = defaultSchoolYear(2026)
    expect(meetingPeriod(year, 'scrutinio', '2027-02-05')?.id).toBe('p1')
    expect(meetingPeriod(year, 'cdc', '2027-02-05')?.id).toBe('p2')
    expect(meetingPeriod(year, 'scrutinio', '2027-06-15')?.id).toBe('p2')
  })

  it('riepilogo della classe dai dati', () => {
    let data = addActivity('c1', '2026-10-05', { ...verifica('v', 'scritto'), topicIds: ['t1'] })(base())
    data = setDone('c1', '2026-10-05', true)(data)
    data = addActivity('c1', '2026-10-07', verifica('w', 'pratico'))(data)
    const summary = classSummary(data, meeting('m', { kind: 'scrutinio', date: '2027-02-05' }))!
    expect(summary.period.id).toBe('p1')
    const [s] = summary.courses
    expect(s.gradesDone).toBe(1)
    expect(s.typesWithoutGrade).toEqual(['teorico', 'pratico'])
    expect(s.topicsLeft).toEqual(['Algoritmi', 'Array'])
    const text = summaryText(meeting('m', { kind: 'scrutinio', date: '2027-02-05' }), summary)
    expect(text).toContain('Scrutinio 3A del 5 feb 2027 · 1° quadrimestre')
    expect(text).toContain('3A · Informatica: 1 voto fatto su 5; senza voto: orale, pratico; 0 argomenti svolti su 2 (non svolti: Algoritmi, Array).')
    // Collegio e classi che non ho: nessun riepilogo.
    expect(classSummary(data, meeting('m', { kind: 'collegio' }))).toBeNull()
    expect(classSummary(data, meeting('m', { className: '5C' }))).toBeNull()
  })

  it('si uniscono tra dispositivi, si annullano e vanno sul calendario con l ora', async () => {
    const { googleCalendarLink, meetingEntry, toIcs } = await import('./calendarExport')
    const start = saveMeeting(meeting('a'))(base())
    vi.setSystemTime(new Date('2026-09-29T11:00:00Z'))
    const phone = saveMeeting(meeting('b', { kind: 'collegio', className: null }))(start)
    const pc = deleteMeeting('a')(start)
    const merged = mergeData(phone, pc)
    expect(Object.keys(merged.meetings)).toEqual(['b'])
    vi.setSystemTime(new Date('2026-09-29T11:00:01Z'))
    expect(Object.keys(undoTo(start)(merged).meetings)).toEqual(['a'])
    expect(normalizeData(JSON.parse(JSON.stringify({ ...merged, meetings: undefined }))).meetings).toEqual({})

    const entry = meetingEntry({ ...meeting('a', { prep: [{ id: 'p', text: 'Verbale', done: false }] }), updatedAt: 0 })
    expect(googleCalendarLink(entry)).toContain('dates=20261020T150000%2F20261020T170000')
    const ics = toIcs([entry], new Date('2026-09-29T10:00:00Z'))
    expect(ics).toContain('DTSTART:20261020T150000')
    expect(ics).toContain('DESCRIPTION:- Verbale')
    expect(ics).toContain('TRANSP:OPAQUE')
  })
})
