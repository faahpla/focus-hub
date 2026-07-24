import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SortableList, SortableItem, DragHandle } from '@/components/ui/sortable'
import { TaskDetailDialog } from './task-detail-dialog'
import { useAppStore } from '@/stores/app-store'
import type { Priority, Task } from '@shared/types'
import { uid, cn } from '@/lib/utils'

const PRIORITY: { id: Priority; label: string; className: string }[] = [
  { id: 'low', label: 'Baixa', className: 'text-muted-foreground' },
  { id: 'medium', label: 'Média', className: 'text-accent' },
  { id: 'high', label: 'Alta', className: 'text-orange-400' },
  { id: 'urgent', label: 'Urgente', className: 'text-destructive' }
]

export function TaskManager({ projectId }: { projectId: string }): JSX.Element {
  const allTasks = useAppStore((s) => s.tasks)
  const saveTask = useAppStore((s) => s.saveTask)
  const saveTasks = useAppStore((s) => s.saveTasks)
  const deleteTask = useAppStore((s) => s.deleteTask)
  const tasks = allTasks
    .filter((t) => t.projectId === projectId)
    .sort((a, b) => a.order - b.order)

  const reorder = (ids: string[]): void => {
    const byId = new Map(tasks.map((t) => [t.id, t]))
    const reordered = ids
      .map((id, index) => {
        const t = byId.get(id)
        return t ? { ...t, order: index } : null
      })
      .filter((t): t is Task => t !== null)
    void saveTasks(reordered)
  }
  const [draft, setDraft] = useState('')
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const add = (): void => {
    const title = draft.trim()
    if (!title) return
    const task: Task = {
      id: uid(),
      projectId,
      title,
      checklist: [],
      priority: 'medium',
      status: 'todo',
      actualMinutes: 0,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: tasks.length
    }
    void saveTask(task)
    setDraft('')
  }

  const cyclePriority = (task: Task): void => {
    const idx = PRIORITY.findIndex((p) => p.id === task.priority)
    void saveTask({ ...task, priority: PRIORITY[(idx + 1) % PRIORITY.length].id })
  }

  const toggleDone = (task: Task): void => {
    void saveTask({ ...task, status: task.status === 'done' ? 'todo' : 'done' })
  }

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Nova tarefa…"
        />
        <Button variant="primary" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1.5">
        <SortableList ids={tasks.map((t) => t.id)} onReorder={reorder}>
          {tasks.map((task) => {
            const prio = PRIORITY.find((p) => p.id === task.priority) ?? PRIORITY[1]
            const done = task.checklist.filter((c) => c.done).length
            return (
              <SortableItem
                key={task.id}
                id={task.id}
                className="group mb-1.5 flex items-center gap-2 rounded-xl border border-border/60 bg-surface/40 px-3 py-2"
              >
                <DragHandle className="shrink-0" />
                <button
                  onClick={() => toggleDone(task)}
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors',
                    task.status === 'done'
                      ? 'border-success bg-success'
                      : 'border-border hover:border-primary/50'
                  )}
                />
                <button
                  onClick={() => setOpenTaskId(task.id)}
                  className={cn(
                    'flex-1 truncate text-left text-sm transition-colors hover:text-primary',
                    task.status === 'done' && 'text-muted-foreground line-through'
                  )}
                  title="Abrir tarefa"
                >
                  {task.title}
                </button>
                {task.checklist.length > 0 && (
                  <Badge variant="outline">
                    {done}/{task.checklist.length}
                  </Badge>
                )}
                <button
                  onClick={() => cyclePriority(task)}
                  className={cn('text-xs font-medium', prio.className)}
                >
                  {prio.label}
                </button>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </SortableItem>
            )
          })}
        </SortableList>
        {tasks.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Nenhuma tarefa. Adicione a primeira acima.
          </p>
        )}
      </div>

      {openTaskId && (
        <TaskDetailDialog taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
      )}
    </div>
  )
}
