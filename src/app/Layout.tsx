import type { ReactNode } from 'react'
import { Link, useRoute } from 'wouter'
import { ClassesIcon, type IconComponent, WeekIcon, YearIcon } from '@/components/icons'
import { InstallButton } from '@/components/InstallButton'
import { SyncButton } from '@/components/SyncButton'
import { ThemeButton } from '@/components/ThemeButton'
import { cn } from '@/lib/utils'
import { useData } from '@/state/data'

function NavLink({ to, icon: Icon, children }: { to: string; icon: IconComponent; children: ReactNode }) {
  const [active] = useRoute(to === '/' ? '/' : `${to}/*?`)
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-1 flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:flex-none sm:flex-row sm:gap-1.5 sm:text-sm',
        active && 'bg-secondary text-foreground',
      )}
    >
      <Icon className="size-5 sm:size-4" />
      {children}
    </Link>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  // Prima di scegliere l'anno scolastico c'è solo il benvenuto: le sezioni non servono ancora.
  const { data } = useData()
  const ready = data.year !== null
  const nav = (
    <>
      <NavLink to="/" icon={WeekIcon}>
        Settimana
      </NavLink>
      <NavLink to="/classi" icon={ClassesIcon}>
        Classi
      </NavLink>
      <NavLink to="/anno" icon={YearIcon}>
        Anno
      </NavLink>
    </>
  )

  return (
    <div className="mx-auto flex min-h-dvh max-w-4xl flex-col px-4">
      <header className="flex items-center justify-between gap-3 py-3">
        <Link to="/" className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight">
          <img src="/favicon.svg" alt="" className="size-7" />
          ProfClick
        </Link>
        {ready && (
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Sezioni">
            {nav}
          </nav>
        )}
        <div className="flex items-center gap-1">
          <InstallButton variant="ghost" size="sm" />
          <ThemeButton />
          <SyncButton />
        </div>
      </header>

      <main className={cn('flex-1 pb-10', ready && 'pb-24 sm:pb-10')}>{children}</main>

      {/* Da telefono la navigazione sta in basso, a portata di pollice. */}
      {ready && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t bg-background/95 px-3 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden"
          aria-label="Sezioni"
        >
          {nav}
        </nav>
      )}
    </div>
  )
}
