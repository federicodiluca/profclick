// Quale icona per quale attività: le valutazioni hanno l'icona del loro tipo di voto.

import {
  BoardIcon,
  CivicsIcon,
  ExerciseIcon,
  type IconComponent,
  LabIcon,
  MinorGradeIcon,
  OralIcon,
  OtherIcon,
  PracticalIcon,
  ReviewIcon,
  WrittenTestIcon,
} from '@/components/icons'
import type { Activity, ActivityKind, GradeType } from '@/core/model'

const KIND_ICONS: Record<Exclude<ActivityKind, 'verifica'>, IconComponent> = {
  spiegazione: BoardIcon,
  esercitazione: ExerciseIcon,
  laboratorio: LabIcon,
  ripasso: ReviewIcon,
  civica: CivicsIcon,
  altro: OtherIcon,
}

export const GRADE_ICONS: Record<GradeType, IconComponent> = {
  scritto: WrittenTestIcon,
  teorico: OralIcon,
  pratico: PracticalIcon,
}

export function activityIcon(activity: Pick<Activity, 'kind' | 'assessment'>): IconComponent {
  if (activity.kind !== 'verifica') return KIND_ICONS[activity.kind]
  if (!activity.assessment) return WrittenTestIcon
  return activity.assessment.weight < 100 ? MinorGradeIcon : GRADE_ICONS[activity.assessment.type]
}
