// Dati di esempio: due classi di informatica con il loro programma, le valutazioni previste,
// un piano già proposto e due riunioni. Servono a provare ProfClick senza inserire niente e per gli
// screenshot.

import { applyProposal, markDone, saveCourse, saveMeeting, saveTopics, setYear } from './actions'
import { courseSlots } from './calendar'
import { addDays, type ISODate, startOfWeek } from './dates'
import { defaultPrep } from './meetings'
import { type Course, emptyData, type GradeType, type ProfclickData } from './model'
import { proposePlan } from './proposal'
import { defaultSchoolYear, schoolYearStart } from './schoolYear'

/** [titolo, ore, periodo, sotto-punti, valutazioni previste come [tipo, peso, dettaglio]] */
type SampleTopic = [string, number, 1 | 2, string[], [GradeType, number, string?][]]

const rules = { perPeriod: null, required: ['scritto', 'teorico', 'pratico'] as GradeType[], minorWeight: 30 }

const PROGRAMS: { course: Omit<Course, 'updatedAt'>; topics: SampleTopic[] }[] = [
  {
    course: {
      id: 'demo-3a',
      className: '3A',
      subject: 'Informatica',
      color: 0,
      schedule: [
        { day: 1, hours: 2, lab: false },
        { day: 3, hours: 1, lab: false },
        { day: 5, hours: 2, lab: true },
      ],
      pastSchedules: [],
      rules,
      civics: { p1: 3 },
      prep: [
        { id: 'demo-3a-p1', text: 'Esercizi di laboratorio su selezione e cicli', topicId: 'demo-3a-t2', done: false },
        { id: 'demo-3a-p2', text: 'Slide sugli array', topicId: 'demo-3a-t3', done: false },
      ],
      notes: 'Laboratorio il venerdì con l\'ITP. Due ragazzi con PDP: verifiche con mappa concettuale.',
      order: 0,
    },
    topics: [
      ['Algoritmi e diagrammi di flusso', 14, 1, ['Problemi e algoritmi', 'Flowgorithm'], [['pratico', 100, 'Flowgorithm']]],
      ['Linguaggio C: variabili e tipi', 10, 1, ['Compilazione', 'printf e scanf'], [['scritto', 100]]],
      ['Selezione e iterazione', 18, 1, ['if / switch', 'while, do-while, for'], [['pratico', 30, 'esercizi in laboratorio'], ['teorico', 100]]],
      ['Array', 16, 1, ['Ricerca e ordinamento'], [['scritto', 100]]],
      ['Funzioni', 16, 2, ['Parametri per valore e per indirizzo'], [['scritto', 100], ['pratico', 100]]],
      ['Stringhe', 10, 2, [], [['teorico', 100]]],
      ['Struct e file', 18, 2, [], [['pratico', 100, 'con orale']]],
      ['Prova parallela', 0, 2, [], [['scritto', 100, 'prova parallela']]],
    ],
  },
  {
    course: {
      id: 'demo-4b',
      className: '4B',
      subject: 'Informatica',
      color: 2,
      schedule: [
        { day: 2, hours: 2, lab: true },
        { day: 4, hours: 2, lab: false },
        { day: 6, hours: 2, lab: true },
      ],
      pastSchedules: [],
      rules,
      civics: { p2: 4 },
      prep: [],
      notes: '',
      order: 1,
    },
    topics: [
      ['Classi e oggetti in Java', 24, 1, ['Incapsulamento', 'Costruttori'], [['scritto', 100], ['pratico', 100]]],
      ['Ereditarietà e polimorfismo', 22, 1, [], [['teorico', 100]]],
      ['Collezioni', 16, 1, ['ArrayList', 'HashMap'], [['pratico', 30, 'flipped classroom']]],
      ['Eccezioni e file', 16, 2, [], [['scritto', 100]]],
      ['Interfacce grafiche', 24, 2, ['Swing / JavaFX'], [['pratico', 75, 'progetto con orale']]],
    ],
  },
]

export function sampleData(today: ISODate): ProfclickData {
  const year = defaultSchoolYear(schoolYearStart(today))
  let data = setYear(year)(emptyData())
  for (const { course, topics } of PROGRAMS) {
    data = saveCourse(course)(data)
    data = saveTopics(
      topics.map(([title, hours, period, points, assessments], i) => ({
        id: `${course.id}-t${i}`,
        courseId: course.id,
        title,
        hours,
        points,
        periodId: `p${period}`,
        assessments: assessments.map(([type, weight, text], j) => ({ id: `${course.id}-t${i}-a${j}`, type, weight, text: text ?? '', done: false })),
        completed: false,
        order: i,
      })),
    )(data)
  }

  // Il piano parte dall'inizio dell'anno; le lezioni passate risultano fatte.
  let n = 0
  for (const { course } of PROGRAMS) {
    for (const period of data.year!.periods) {
      const proposal = proposePlan(data, data.courses[course.id], period, period.start)
      data = applyProposal(course.id, proposal.lessons, () => `demo-a${n++}`)(data)
    }
    const past = courseSlots(data, data.courses[course.id], undefined, today).filter((s) => s.date < today && s.lesson)
    data = markDone(past)(data)
  }

  // Un consiglio di classe da coordinatore tra due settimane e un collegio dopo.
  const tuesday = addDays(startOfWeek(today), 15)
  data = saveMeeting({ id: 'demo-m1', kind: 'cdc', date: tuesday, time: '15:00', className: '3A', title: '', coordinator: true, prep: defaultPrep('cdc', true, ((i) => () => `demo-m1-p${i++}`)(0)), notes: '' })(data)
  data = saveMeeting({ id: 'demo-m2', kind: 'collegio', date: addDays(tuesday, 2), time: '16:30', className: null, title: '', coordinator: false, prep: defaultPrep('collegio', false, () => 'demo-m2-p0'), notes: '' })(data)
  return data
}
