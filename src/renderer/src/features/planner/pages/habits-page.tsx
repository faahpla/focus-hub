import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Flame, Plus, Target, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { DynamicIcon } from '@/components/dynamic-icon'
import { Tooltip } from '@/components/ui/tooltip'
import { PageHeader } from '@/components/layout/page-header'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import type { Habit, PlannerGoal } from '@shared/planner'
import { isChecked, toggleCheckin } from '@shared/planner'
import { HabitDialog } from '../components/habit-dialog'
import { PlannerGoalDialog } from '../components/planner-goal-dialog'
import { completionRate, isDueOn, streakOf } from '../services/habits-service'
import { goalPace, goalProgress } from '../services/goals-service'
import { type DayKey, addDaysToKey, dayLabel, today } from '@/lib/dates'

/** Days shown in the habit grid — a comfortable four weeks back. */
const WINDOW = 28

export function HabitsPage(): JSX.Element {
  const habits = useAppStore((s) => s.habits)
  const goals = useAppStore((s) => s.plannerGoals)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [editingGoal, setEditingGoal] = useState<PlannerGoal | null>(null)
  const [creatingHabit, setCreatingHabit] = useState(false)
  const [creatingGoal, setCreatingGoal] = useState(false)

  const days = useMemo(() => {
    const end = today()
    return Array.from({ length: WINDOW }, (_, i) => addDaysToKey(end, -(WINDOW - 1 - i)))
  }, [])

  const activeHabits = habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order)
  const activeGoals = goals.filter((g) => !g.archived).sort((a, b) => a.order - b.order)

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <PageHeader
        title="Hábitos e metas"
        subtitle="O que você repete e o que isso constrói."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCreatingGoal(true)}>
              <Target className="h-4 w-4" /> Nova meta
            </Button>
            <Button variant="primary" onClick={() => setCreatingHabit(true)}>
              <Plus className="h-4 w-4" /> Novo hábito
            </Button>
          </div>
        }
      />

      <div className="space-y-5 px-8 pb-24">
        {/* Goals */}
        {activeGoals.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activeGoals.map((goal, i) => (
              <GoalCard key={goal.id} goal={goal} index={i} onEdit={() => setEditingGoal(goal)} />
            ))}
          </div>
        )}

        {/* Habits */}
        {activeHabits.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Flame className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">Nenhum hábito ainda</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Academia, água, leitura, dormir cedo. Um toque por dia — e faltas dentro da
              tolerância não quebram a sequência.
            </p>
            <Button variant="primary" className="mt-5" onClick={() => setCreatingHabit(true)}>
              <Plus className="h-4 w-4" /> Criar hábito
            </Button>
          </Card>
        ) : (
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold">Últimos {WINDOW} dias</h3>
            <div className="space-y-2 overflow-x-auto scrollbar-thin">
              {activeHabits.map((habit) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  days={days}
                  onEdit={() => setEditingHabit(habit)}
                />
              ))}
            </div>
          </Card>
        )}
      </div>

      {creatingHabit && <HabitDialog onClose={() => setCreatingHabit(false)} />}
      {editingHabit && <HabitDialog habit={editingHabit} onClose={() => setEditingHabit(null)} />}
      {creatingGoal && <PlannerGoalDialog onClose={() => setCreatingGoal(false)} />}
      {editingGoal && (
        <PlannerGoalDialog goal={editingGoal} onClose={() => setEditingGoal(null)} />
      )}
    </div>
  )
}

function HabitRow({
  habit,
  days,
  onEdit
}: {
  habit: Habit
  days: DayKey[]
  onEdit: () => void
}): JSX.Element {
  const savePlanner = useAppStore((s) => s.savePlanner)
  const streak = streakOf(habit)
  const rate = completionRate(habit, days)

  const toggle = (day: DayKey): void => {
    void savePlanner('habits', { ...habit, checkins: toggleCheckin(habit, day) })
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onEdit}
        className="no-drag flex w-40 shrink-0 items-center gap-2 text-left"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `hsl(${habit.color} / 0.15)`, color: `hsl(${habit.color})` }}
        >
          <DynamicIcon name={habit.icon} className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{habit.name}</span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Flame className="h-2.5 w-2.5 text-[hsl(25_90%_60%)]" />
            {streak.current} · recorde {streak.longest}
          </span>
        </span>
      </button>

      <div className="flex flex-1 gap-[3px]">
        {days.map((day) => {
          const due = isDueOn(habit, day)
          const checked = isChecked(habit, day)
          const isToday = day === today()
          return (
            <Tooltip key={day} label={`${dayLabel(day)}${due ? '' : ' · dia de folga'}`} side="top">
              <button
                onClick={() => toggle(day)}
                className={cn(
                  'h-6 flex-1 rounded-[4px] transition-colors',
                  checked
                    ? 'bg-success'
                    : due
                      ? 'bg-muted/50 hover:bg-muted'
                      : 'bg-muted/20 hover:bg-muted/40',
                  isToday && 'ring-1 ring-primary ring-offset-1 ring-offset-surface'
                )}
              />
            </Tooltip>
          )
        })}
      </div>

      <span className="w-10 shrink-0 text-right text-xs tabular text-muted-foreground">
        {Math.round(rate * 100)}%
      </span>
    </div>
  )
}

function GoalCard({
  goal,
  index,
  onEdit
}: {
  goal: PlannerGoal
  index: number
  onEdit: () => void
}): JSX.Element {
  const data = useAppStore()
  const progress = goalProgress(goal, data)
  const pace = goalPace(goal, progress)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Card
        className={cn('p-4 transition-colors', progress.done && 'border-success/35 bg-success/[0.05]')}
      >
        <button onClick={onEdit} className="no-drag flex w-full items-start gap-3 text-left">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `hsl(${goal.color} / 0.15)`, color: `hsl(${goal.color})` }}
          >
            <DynamicIcon name={goal.icon} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{goal.name}</p>
            <p className="text-xs text-muted-foreground">
              {progress.current} de {progress.target} {progress.unit} · {progress.range.label}
            </p>
          </div>
          {progress.done && <Check className="h-4 w-4 shrink-0 text-success" />}
        </button>

        <div className="mt-3">
          <ProgressBar
            value={progress.ratio}
            indicatorClassName={progress.done ? 'bg-success' : undefined}
          />
        </div>

        {pace && (
          <p
            className={cn(
              'mt-2 flex items-center gap-1 text-[11px]',
              pace.onTrack ? 'text-success' : 'text-[hsl(45_90%_58%)]'
            )}
          >
            <TrendingUp className="h-3 w-3" />
            {pace.onTrack
              ? 'No ritmo do prazo'
              : `Atrasada: o esperado até hoje era ${pace.expected}`}
          </p>
        )}
      </Card>
    </motion.div>
  )
}
