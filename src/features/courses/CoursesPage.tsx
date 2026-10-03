import { useState } from 'react'
import { Link, useLocation } from 'wouter'
import { CourseName, ProgressBar } from '@/components/bits'
import { PlusIcon, TimetableIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { currentPeriod, sortedCourses } from '@/core/calendar'
import { today } from '@/core/dates'
import { periodGrades } from '@/core/grading'
import { weeklyHours } from '@/core/model'
import { topicProgress } from '@/core/progress'
import { courseSurface, gradesLine } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { useData } from '@/state/data'
import { CourseDialog } from './CourseDialog'

export default function CoursesPage() {
  const { data } = useData()
  const [, navigate] = useLocation()
  const [creating, setCreating] = useState(false)
  const now = today()
  const period = data.year ? currentPeriod(data.year, now) : undefined
  const courses = sortedCourses(data)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">Classi</h1>
        <div className="flex gap-2">
          {courses.length > 0 && (
            <Button variant="outline" asChild>
              <Link to="/orario">
                <TimetableIcon /> Orario
              </Link>
            </Button>
          )}
          <Button onClick={() => setCreating(true)}>
            <PlusIcon /> Nuova classe
          </Button>
        </div>
      </div>

      {courses.length === 0 && <p className="text-muted-foreground">Ancora nessuna classe. Creane una con il suo orario settimanale.</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {courses.map((course) => {
          const progress = topicProgress(data, course)
          const done = progress.filter((p) => p.status === 'fatto').length
          const grades = period ? periodGrades(data, course, period, now) : undefined
          return (
            <Link key={course.id} to={`/classi/${course.id}`} style={courseSurface(course)} className="block space-y-3 rounded-xl border bg-card p-4 pl-5 shadow-xs transition-opacity hover:opacity-85">
              <div className="flex items-center justify-between gap-2">
                <CourseName course={course} className="font-semibold" />
                <span className="text-xs text-muted-foreground">{weeklyHours(course)} h/sett.</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Programma</span>
                  <span>
                    {done}/{progress.length} argomenti
                  </span>
                </div>
                <ProgressBar value={done} max={progress.length} />
              </div>
              {grades && period && (
                <p className={cn('text-xs', grades.status === 'ok' ? 'text-muted-foreground' : grades.status === 'a-rischio' ? 'text-pencil-red' : 'text-warn')}>
                  Voti del {period.name}: {gradesLine(grades)}
                </p>
              )}
            </Link>
          )
        })}
      </div>

      <CourseDialog open={creating} onClose={() => setCreating(false)} onSaved={(id) => navigate(`/classi/${id}`)} />
    </div>
  )
}
