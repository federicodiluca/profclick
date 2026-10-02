// Segni a mano della matita rossa e blu del logo: pochi, dove il docente segnerebbe davvero
// (oggi cerchiato, la lezione spuntata). La grana li fa sembrare grafite sul tema chiaro e
// gessetto colorato su quello scuro; il colore è currentColor, di solito text-pencil-blue.

import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

/** Il filtro della grana, una volta sola nella pagina: i segni lo richiamano per id. */
export function PencilFilters() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        {/* Bordi appena mossi e qualche puntino scoperto. */}
        <filter id="pencil-grain" x="-10%" y="-60%" width="120%" height="220%">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" result="moved" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2 1.75" result="specks" />
          <feComposite in="moved" in2="specks" operator="in" />
        </filter>
      </defs>
    </svg>
  )
}

function Mark({ className, children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      filter="url(#pencil-grain)"
      aria-hidden="true"
      className={cn('pointer-events-none overflow-visible', className)}
      {...props}
    >
      {children}
    </svg>
  )
}

/** Un giro a mano attorno a una parola, aperto e un po' storto. Va in un contenitore relative. */
export function PencilCircle({ className }: { className?: string }) {
  return (
    <Mark viewBox="0 0 100 40" preserveAspectRatio="none" className={cn('absolute -top-2.5 -left-3.5 h-[calc(100%+1.25rem)] w-[calc(100%+1.75rem)]', className)}>
      <path vectorEffect="non-scaling-stroke" d="M58 4C86 3 99 12 97 21 95 32 66 38 38 36 12 34 1 25 4 15 7 6 28 2 66 6" />
    </Mark>
  )
}

/** La spunta del fatto, tirata veloce: esce un po' dal suo cerchio. */
export function PencilTick({ className }: { className?: string }) {
  return (
    <Mark viewBox="0 0 24 24" className={className}>
      <path d="M3 13.5C5 15 7.5 17.5 9 20.5 12 13 16 7 23 1.5" />
    </Mark>
  )
}
