// Le classi da vedere: si accendono e si spengono con un tocco. La scelta vale per la
// settimana e per la lista Da fare.

import { courseColor } from '@/lib/ui'
import { type Course, courseLabel } from '@/core/model'
import { cn } from '@/lib/utils'

export function CourseFilter({ courses, hidden, onToggle, onShowAll }: { courses: Course[]; hidden: Set<string>; onToggle: (id: string) => void; onShowAll: () => void }) {
  const anyHidden = courses.some((c) => hidden.has(c.id))
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Classi da vedere">
      {courses.map((course) => {
        const on = !hidden.has(course.id)
        return (
          <button
            key={course.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(course.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              on ? 'bg-card text-foreground shadow-xs' : 'border-dashed text-muted-foreground line-through hover:text-foreground',
            )}
          >
            <span
              className="size-2.5 shrink-0 rounded-full border-2"
              style={{ borderColor: courseColor(course), background: on ? courseColor(course) : 'transparent' }}
            />
            {courseLabel(course)}
          </button>
        )
      })}
      {anyHidden && (
        <button type="button" onClick={onShowAll} className="px-1.5 text-xs font-medium text-primary hover:underline">
          Mostra tutte
        </button>
      )}
    </div>
  )
}
