import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarPlus, ListChecks, Play, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProgressBar } from '@/components/ui/progress-bar'
import { useAppStore } from '@/stores/app-store'
import { useSessionStore } from '@/stores/session-store'
import { useToastStore } from '@/stores/toast-store'
import { uid } from '@/lib/utils'
import type { BoardCard, Board, Task } from '@shared/types'
import { TaskDetailDialog } from '@/features/projects/task-detail-dialog'
import { TaskRow } from './task-row'
import { taskDuration } from '../services/scheduler'
import { formatMinutes } from '../utils/time'
import { today } from '@/lib/dates'

/** Steps most video cards go through, offered as one-click scaffolding. */
const TEMPLATE = ['Roteiro', 'Gravar', 'Editar', 'Thumbnail', 'Publicar']

/**
 * A card's tasks.
 *
 * A card is a deliverable — a video, an article — and a deliverable is made of
 * several steps, not one. The old model linked a card to a single task, which
 * meant an eight-step production had to pretend to be one item. Now the tasks
 * point at the card, so a card can own as many as the work actually needs.
 */
export function CardTasksPanel({
  card,
  board,
  onClose
}: {
  card: BoardCard
  board: Board
  onClose: () => void
}): JSX.Element {
  const tasks = useAppStore((s) => s.tasks)
  const settings = useAppStore((s) => s.planner)
  const projects = useAppStore((s) => s.projects)
  const saveTask = useAppStore((s) => s.saveTask)
  const saveTasks = useAppStore((s) => s.saveTasks)
  const pushToast = useToastStore((s) => s.push)
  const configure = useSessionStore((s) => s.configure)
  const navigate = useNavigate()

  const [draft, setDraft] = useState('')
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const cardTasks = tasks
    .filter((t) => t.cardId === card.id)
    .sort((a, b) => a.order - b.order)
  const done = cardTasks.filter((t) => t.status === 'done').length
  const totalMinutes = cardTasks
    .filter((t) => t.status !== 'done')
    .reduce((sum, t) => sum + taskDuration(t, settings), 0)

  const makeTask = (title: string, order: number): Task => {
    const stamp = new Date().toISOString()
    return {
      id: uid(),
      // Inherit the board's project so the work lands in the right place.
      projectId: board.projectId,
      cardId: card.id,
      title,
      checklist: [],
      priority: 'medium',
      status: 'todo',
      actualMinutes: 0,
      tags: [...card.tags],
      dueDate: card.dueDate,
      createdAt: stamp,
      updatedAt: stamp,
      order
    }
  }

  const add = (): void => {
    const title = draft.trim()
    if (!title) return
    void saveTask(makeTask(title, cardTasks.length))
    setDraft('')
  }

  const addTemplate = (): void => {
    const created = TEMPLATE.map((title, i) => makeTask(title, cardTasks.length + i))
    // Each step waits on the one before it — the roteiro really does have to
    // exist before there is anything to record.
    for (let i = 1; i < created.length; i++) created[i].blockedBy = [created[i - 1].id]
    void saveTasks(created)
    pushToast({
      title: 'Etapas criadas',
      lines: ['Cada uma só libera quando a anterior for concluída.'],
      variant: 'success'
    })
  }

  const scheduleAll = (): void => {
    const stamp = new Date().toISOString()
    const changed = cardTasks
      .filter((t) => t.status !== 'done' && !t.scheduledDate)
      .map((t) => ({ ...t, scheduledDate: today(), updatedAt: stamp }))
    if (changed.length === 0) return
    void saveTasks(changed)
    pushToast({
      title: `${changed.length} tarefa(s) para hoje`,
      lines: ['Use “Organizar meu dia” para encaixar nos horários livres.'],
      variant: 'success'
    })
  }

  const start = (task: Task): void => {
    configure({
      project: projects.find((p) => p.id === task.projectId),
      task,
      minutes: Math.max(5, taskDuration(task, settings))
    })
    onClose()
    navigate('/')
  }

  return (
    <div className="rounded-xl border border-border/70 bg-surface/40 p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <ListChecks className="h-4 w-4 text-primary" /> Tarefas
        </p>
        {cardTasks.length > 0 && (
          <span className="text-[11px] tabular text-muted-foreground">
            {done}/{cardTasks.length}
            {totalMinutes > 0 && ` · ${formatMinutes(totalMinutes)}`}
          </span>
        )}
      </div>

      {cardTasks.length > 0 && (
        <div className="mb-2.5">
          <ProgressBar
            value={done / cardTasks.length}
            className="h-1.5"
            indicatorClassName={done === cardTasks.length ? 'bg-success' : undefined}
          />
        </div>
      )}

      {cardTasks.length === 0 ? (
        <div className="mb-2.5">
          <p className="mb-2 text-xs text-muted-foreground">
            Quebre este card nas etapas do seu processo. Cada uma pode ter horário, duração e
            sessão de foco.
          </p>
          <Button size="sm" variant="secondary" className="w-full" onClick={addTemplate}>
            <Plus className="h-3.5 w-3.5" /> Criar etapas padrão
          </Button>
        </div>
      ) : (
        <div className="-mx-1.5 mb-2">
          {cardTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              compact
              showTime={false}
              onOpen={(t) => setOpenTaskId(t.id)}
              onStart={start}
            />
          ))}
        </div>
      )}

      <Input
        value={draft}
        placeholder="Adicionar etapa e Enter…"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
        className="h-9 text-xs"
      />

      {cardTasks.some((t) => t.status !== 'done' && !t.scheduledDate) && (
        <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={scheduleAll}>
          <CalendarPlus className="h-3.5 w-3.5" /> Jogar tudo para hoje
        </Button>
      )}

      {cardTasks.length > 0 && cardTasks.every((t) => t.status === 'done') && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-success">
          <Play className="h-3 w-3" /> Todas as etapas concluídas.
        </p>
      )}

      {openTaskId && (
        <TaskDetailDialog taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
      )}
    </div>
  )
}
