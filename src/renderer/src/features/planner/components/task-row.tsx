import { Check, Clock, Link2, Lock, Play } from 'lucide-react'
import { motion } from 'framer-motion'
import { DynamicIcon } from '@/components/dynamic-icon'
import { Tooltip } from '@/components/ui/tooltip'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import type { Priority, Task } from '@shared/types'
import { formatMinutesShort } from '../utils/time'
import { indexTasks, openDependencies } from '../services/dependencies'
import { taskDuration } from '../services/scheduler'

const PRIORITY_STYLE: Record<Priority, string> = {
  urgent: 'bg-destructive',
  high: 'bg-[hsl(25_90%_60%)]',
  medium: 'bg-primary/60',
  low: 'bg-muted-foreground/40'
}

const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa'
}

/**
 * One task, everywhere. Shows the four things that answer "should I do this
 * now?" — when, how long, what it belongs to, and whether something is still
 * blocking it.
 */
export function TaskRow({
  task,
  onOpen,
  onStart,
  compact,
  showTime = true,
  highlight
}: {
  task: Task
  onOpen?: (task: Task) => void
  /** Omitted when starting a focus session doesn't make sense here. */
  onStart?: (task: Task) => void
  compact?: boolean
  showTime?: boolean
  highlight?: boolean
}): JSX.Element {
  const tasks = useAppStore((s) => s.tasks)
  const projects = useAppStore((s) => s.projects)
  const cards = useAppStore((s) => s.cards)
  const settings = useAppStore((s) => s.planner)
  const saveTask = useAppStore((s) => s.saveTask)

  const done = task.status === 'done'
  const blockers = openDependencies(task, indexTasks(tasks))
  const project = projects.find((p) => p.id === task.projectId)
  const card = cards.find((c) => c.id === task.cardId)
  const checklistDone = task.checklist.filter((i) => i.done).length

  const toggle = (e: React.MouseEvent): void => {
    e.stopPropagation()
    const stamp = new Date().toISOString()
    void saveTask({
      ...task,
      status: done ? 'todo' : 'done',
      completedAt: done ? undefined : stamp,
      updatedAt: stamp
    })
  }

  return (
    <motion.div
      layout="position"
      onClick={() => onOpen?.(task)}
      className={cn(
        'group flex items-center gap-3 rounded-xl border border-transparent px-3 transition-colors',
        compact ? 'py-1.5' : 'py-2.5',
        onOpen && 'cursor-pointer hover:border-border/70 hover:bg-surface-hover/70',
        done && 'opacity-55',
        blockers.length > 0 && !done && 'opacity-75',
        highlight && 'border-primary/50 bg-primary/5'
      )}
    >
      {/* Priority spine */}
      <span
        className={cn('h-8 w-[3px] shrink-0 rounded-full', PRIORITY_STYLE[task.priority])}
        title={`Prioridade ${PRIORITY_LABEL[task.priority].toLowerCase()}`}
      />

      <button
        onClick={toggle}
        className={cn(
          'no-drag flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          done
            ? 'border-success bg-success text-white'
            : 'border-border hover:border-success hover:bg-success/10'
        )}
        title={done ? 'Marcar como não feita' : 'Concluir'}
      >
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={cn('truncate text-sm', done && 'line-through')}>{task.title}</p>
          {blockers.length > 0 && !done && (
            <Tooltip label={`Esperando: ${blockers.map((b) => b.title).join(', ')}`}>
              <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
            </Tooltip>
          )}
          {card && (
            <Tooltip label={`Card: ${card.title}`}>
              <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
            </Tooltip>
          )}
        </div>

        {!compact && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {project && (
              <span className="flex items-center gap-1">
                <DynamicIcon
                  name={project.icon}
                  className="h-3 w-3"
                  style={{ color: `hsl(${project.color})` }}
                />
                {project.name}
              </span>
            )}
            {card && <span className="truncate">{card.title}</span>}
            {task.checklist.length > 0 && (
              <span>
                {checklistDone}/{task.checklist.length}
              </span>
            )}
            {task.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {showTime && (
        <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          {task.startTime ? (
            <span className="tabular font-medium text-foreground">{task.startTime}</span>
          ) : null}
          <span className="flex items-center gap-1 tabular">
            <Clock className="h-3 w-3" />
            {formatMinutesShort(taskDuration(task, settings))}
          </span>
        </div>
      )}

      {onStart && !done && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onStart(task)
          }}
          className="no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-primary/15 hover:text-primary group-hover:opacity-100"
          title="Iniciar sessão de foco"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
        </button>
      )}
    </motion.div>
  )
}
