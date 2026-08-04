import { useState } from 'react'
import { CalendarDays, Flame, Lock, Pin, Plus, Target, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { DynamicIcon } from '@/components/dynamic-icon'
import { useAppStore } from '@/stores/app-store'
import { useToastStore } from '@/stores/toast-store'
import { cn } from '@/lib/utils'
import type { Task, TaskEnergy } from '@shared/types'
import { today } from '@/lib/dates'
import { formatMinutes } from '../utils/time'
import { indexTasks, wouldCycle } from '../services/dependencies'
import { taskDuration } from '../services/scheduler'

const ENERGY: { value: TaskEnergy; label: string }[] = [
  { value: 'low', label: 'Leve' },
  { value: 'medium', label: 'Normal' },
  { value: 'high', label: 'Pesada' }
]

const QUICK_DURATIONS = [15, 30, 45, 60, 90, 120]

/**
 * The scheduling half of a task: when, how long, what blocks it, what it feeds.
 *
 * Note that nothing here is required. A task with no date is a perfectly good
 * task sitting in the backlog — the planner is a tool, not a toll gate.
 */
export function PlanningSection({ task }: { task: Task }): JSX.Element {
  const tasks = useAppStore((s) => s.tasks)
  const goals = useAppStore((s) => s.plannerGoals)
  const cards = useAppStore((s) => s.cards)
  const settings = useAppStore((s) => s.planner)
  const saveTask = useAppStore((s) => s.saveTask)
  const pushToast = useToastStore((s) => s.push)
  const [addingBlocker, setAddingBlocker] = useState(false)

  const patch = (p: Partial<Task>): void => {
    const base = useAppStore.getState().tasks.find((t) => t.id === task.id) ?? task
    void saveTask({ ...base, ...p, updatedAt: new Date().toISOString() })
  }

  const index = indexTasks(tasks)
  const blockers = (task.blockedBy ?? [])
    .map((id) => index.get(id))
    .filter((t): t is Task => Boolean(t))
  const duration = taskDuration(task, settings)
  const card = cards.find((c) => c.id === task.cardId)

  const addBlocker = (id: string): void => {
    setAddingBlocker(false)
    if (!id || task.blockedBy?.includes(id)) return
    if (wouldCycle(task.id, id, index)) {
      pushToast({
        title: 'Isso criaria um ciclo',
        description: 'As duas tarefas ficariam esperando uma pela outra para sempre.',
        variant: 'warning'
      })
      return
    }
    patch({ blockedBy: [...(task.blockedBy ?? []), id] })
  }

  const candidates = tasks.filter(
    (t) => t.id !== task.id && t.status !== 'done' && !task.blockedBy?.includes(t.id)
  )

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-surface/40 p-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-3.5 w-3.5 text-primary" />
        <p className="text-sm font-medium">Planejamento</p>
        {card && (
          <span className="ml-auto truncate text-[11px] text-muted-foreground">
            Entrega: {card.title}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted-foreground">Quando</span>
          <DatePicker
            value={task.scheduledDate}
            onChange={(scheduledDate) =>
              patch({ scheduledDate, startTime: scheduledDate ? task.startTime : undefined })
            }
            placeholder="Sem data"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs text-muted-foreground">Horário</span>
          <Input
            type="time"
            value={task.startTime ?? ''}
            disabled={!task.scheduledDate}
            onChange={(e) => patch({ startTime: e.target.value || undefined, pinned: true })}
            className="h-10 tabular"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs text-muted-foreground">Energia</span>
          <Select<TaskEnergy>
            value={task.energy ?? 'medium'}
            options={ENERGY}
            onChange={(energy) => patch({ energy })}
          />
        </label>
      </div>

      {/* Duration */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Duração do bloco</span>
          <span className="text-xs tabular">{formatMinutes(duration)}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_DURATIONS.map((minutes) => (
            <button
              key={minutes}
              onClick={() => patch({ durationMinutes: minutes })}
              className={cn(
                'no-drag rounded-lg px-2.5 py-1 text-xs transition-colors',
                duration === minutes
                  ? 'bg-primary/15 text-primary'
                  : 'bg-surface-elevated text-muted-foreground hover:text-foreground'
              )}
            >
              {minutes < 60 ? `${minutes}min` : `${minutes / 60}h`}
            </button>
          ))}
        </div>
      </div>

      {/* Quick date shortcuts + pin */}
      <div className="flex flex-wrap items-center gap-1.5">
        <QuickDay label="Hoje" onClick={() => patch({ scheduledDate: today() })} />
        <QuickDay label="Amanhã" onClick={() => patch({ scheduledDate: tomorrow() })} />
        <QuickDay
          label="Tirar do dia"
          onClick={() => patch({ scheduledDate: undefined, startTime: undefined, pinned: false })}
        />
        <div className="flex-1" />
        <button
          onClick={() => patch({ pinned: !task.pinned })}
          disabled={!task.startTime}
          className={cn(
            'no-drag flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-40',
            task.pinned
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border/70 text-muted-foreground hover:text-foreground'
          )}
          title="Horário fixo: o Organizar meu dia não move esta tarefa"
        >
          <Pin className={cn('h-3 w-3', task.pinned && 'fill-current')} />
          {task.pinned ? 'Horário fixo' : 'Fixar horário'}
        </button>
      </div>

      {/* Dependencies */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Só depois de</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {blockers.map((blocker) => (
            <span
              key={blocker.id}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2 py-1 text-xs',
                blocker.status === 'done'
                  ? 'bg-success/12 text-success line-through'
                  : 'bg-surface-elevated'
              )}
            >
              {blocker.title}
              <button
                onClick={() =>
                  patch({ blockedBy: task.blockedBy?.filter((id) => id !== blocker.id) })
                }
                className="no-drag text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {addingBlocker ? (
            <div className="w-64">
              <Select<string>
                options={candidates.map((t) => ({ value: t.id, label: t.title }))}
                onChange={addBlocker}
                onClear={() => setAddingBlocker(false)}
                clearable
                clearLabel="Cancelar"
                placeholder="Escolher tarefa…"
              />
            </div>
          ) : (
            <button
              onClick={() => setAddingBlocker(true)}
              className="no-drag flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> Dependência
            </button>
          )}
        </div>
      </div>

      {/* Goal */}
      {goals.filter((g) => !g.archived).length > 0 && (
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Target className="h-3 w-3" /> Alimenta a meta
          </span>
          <Select<string>
            value={task.goalId}
            options={goals
              .filter((g) => !g.archived)
              .map((g) => ({
                value: g.id,
                label: g.name,
                adornment: (
                  <DynamicIcon
                    name={g.icon}
                    className="h-3.5 w-3.5"
                    style={{ color: `hsl(${g.color})` }}
                  />
                )
              }))}
            onChange={(goalId) => patch({ goalId })}
            onClear={() => patch({ goalId: undefined })}
            clearable
            clearLabel="Nenhuma meta"
            placeholder="Nenhuma meta"
          />
        </label>
      )}

      {task.energy === 'high' && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Flame className="h-3 w-3 text-[hsl(25_90%_60%)]" />
          Tarefas pesadas são colocadas mais cedo no dia.
        </p>
      )}
    </div>
  )
}

function QuickDay({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="no-drag rounded-lg bg-surface-elevated px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
    </button>
  )
}

function tomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
