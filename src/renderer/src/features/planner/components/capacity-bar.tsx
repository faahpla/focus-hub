import { AlertTriangle, Battery } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMinutes } from '../utils/time'
import type { DayCapacity } from '../services/scheduler'

/**
 * Planned hours against hours that exist.
 *
 * This is the most important number on the screen, and the one every other
 * planner leaves out. Committing to fourteen hours of work in a six-hour day
 * is not a discipline problem — it is arithmetic, and it fails every time.
 * Showing it before the day starts is what keeps the plan believable.
 */
export function CapacityBar({ capacity }: { capacity: DayCapacity }): JSX.Element | null {
  const { availableMinutes, plannedMinutes, overloadMinutes, taskCount, doneCount } = capacity
  if (taskCount === 0 && plannedMinutes === 0) return null

  const overloaded = overloadMinutes > 0
  const fill = availableMinutes > 0 ? Math.min(1, plannedMinutes / availableMinutes) : 0
  const tone = overloaded
    ? 'bg-destructive'
    : fill > 0.85
      ? 'bg-[hsl(45_90%_58%)]'
      : 'bg-success'

  return (
    <div className="rounded-2xl border border-border/70 bg-surface/50 p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Battery className="h-3.5 w-3.5" />
          Capacidade do dia
        </span>
        <span className="text-xs tabular">
          <span className={cn(overloaded && 'text-destructive font-medium')}>
            {formatMinutes(plannedMinutes)}
          </span>
          <span className="text-muted-foreground"> de {formatMinutes(availableMinutes)}</span>
        </span>
      </div>

      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', tone)}
          style={{ width: `${fill * 100}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">
          {doneCount}/{taskCount} concluídas
        </span>
        {overloaded ? (
          <span className="flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {formatMinutes(overloadMinutes)} a mais do que cabe hoje
          </span>
        ) : (
          <span className="text-muted-foreground">
            {formatMinutes(Math.max(0, availableMinutes - plannedMinutes))} livres
          </span>
        )}
      </div>
    </div>
  )
}
