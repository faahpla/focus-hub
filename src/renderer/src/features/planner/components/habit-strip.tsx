import { motion } from 'framer-motion'
import { Check, Flame, Plus } from 'lucide-react'
import { DynamicIcon } from '@/components/dynamic-icon'
import { Tooltip } from '@/components/ui/tooltip'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import type { Habit } from '@shared/planner'
import { isChecked, toggleCheckin } from '@shared/planner'
import { type DayKey, today } from '@/lib/dates'
import { isDueOn, streakOf, weekProgress } from '../services/habits-service'

/**
 * The day's habits as a row of tap targets.
 *
 * One tap, no dialog, no confirmation — a habit tracker that costs more than a
 * second per entry stops being used within a week.
 */
export function HabitStrip({
  day = today(),
  onManage
}: {
  day?: DayKey
  onManage?: () => void
}): JSX.Element | null {
  const habits = useAppStore((s) => s.habits)
  const savePlanner = useAppStore((s) => s.savePlanner)

  const due = habits.filter((h) => !h.archived && isDueOn(h, day)).sort((a, b) => a.order - b.order)
  if (due.length === 0) {
    if (!onManage) return null
    return (
      <button
        onClick={onManage}
        className="no-drag flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 p-4 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" /> Criar um hábito
      </button>
    )
  }

  const toggle = (habit: Habit): void => {
    void savePlanner('habits', { ...habit, checkins: toggleCheckin(habit, day) })
  }

  const doneCount = due.filter((h) => isChecked(h, day)).length

  return (
    <div className="rounded-2xl border border-border/70 bg-surface/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Hábitos</span>
        <span className="text-xs tabular text-muted-foreground">
          {doneCount}/{due.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {due.map((habit) => {
          const checked = isChecked(habit, day)
          const streak = streakOf(habit, day)
          const week = weekProgress(habit, day)
          const hint =
            habit.frequency === 'weekly-count'
              ? `${week.done}/${week.target} esta semana`
              : streak.current > 0
                ? `${streak.current} dia${streak.current === 1 ? '' : 's'} seguidos`
                : 'Comece hoje'

          return (
            <Tooltip key={habit.id} label={`${habit.name} · ${hint}`} side="top">
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => toggle(habit)}
                className={cn(
                  'no-drag flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors',
                  checked
                    ? 'border-success/40 bg-success/10'
                    : 'border-border/70 bg-surface/40 hover:bg-surface-hover'
                )}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: checked ? 'hsl(var(--success) / 0.18)' : `hsl(${habit.color} / 0.15)`,
                    color: checked ? 'hsl(var(--success))' : `hsl(${habit.color})`
                  }}
                >
                  {checked ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : (
                    <DynamicIcon name={habit.icon} className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className={cn('text-xs', checked && 'text-success')}>{habit.name}</span>
                {streak.current >= 2 && (
                  <span className="flex items-center gap-0.5 text-[10px] tabular text-muted-foreground">
                    <Flame className="h-3 w-3 text-[hsl(25_90%_60%)]" />
                    {streak.current}
                  </span>
                )}
              </motion.button>
            </Tooltip>
          )
        })}

        {onManage && (
          <button
            onClick={onManage}
            className="no-drag flex items-center gap-1 rounded-xl border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
