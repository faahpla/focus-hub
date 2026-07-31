import { useState } from 'react'
import { Check, Clock, Maximize2, Timer, Trash2, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChecklistPanel } from '@/features/session/checklist-panel'
import { ScriptReader } from '@/features/boards/script-reader'
import { useAppStore } from '@/stores/app-store'
import { useAutosavedText } from '@/hooks/use-autosave'
import type { Priority, Task, TaskStatus } from '@shared/types'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

const PRIORITY: { id: Priority; label: string; className: string }[] = [
  { id: 'low', label: 'Baixa', className: 'data-[on=true]:bg-muted data-[on=true]:text-foreground' },
  { id: 'medium', label: 'Média', className: 'data-[on=true]:bg-accent/20 data-[on=true]:text-accent' },
  { id: 'high', label: 'Alta', className: 'data-[on=true]:bg-orange-500/20 data-[on=true]:text-orange-400' },
  { id: 'urgent', label: 'Urgente', className: 'data-[on=true]:bg-destructive/20 data-[on=true]:text-destructive' }
]

const STATUS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'A fazer' },
  { id: 'in-progress', label: 'Em progresso' },
  { id: 'done', label: 'Concluída' }
]

export function TaskDetailDialog({
  taskId,
  onClose
}: {
  taskId: string
  onClose: () => void
}): JSX.Element | null {
  const task = useAppStore((s) => s.tasks.find((t) => t.id === taskId))
  // Resolve first so the autosave hooks below always run.
  if (!task) return null
  return <TaskEditor task={task} onClose={onClose} />
}

function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }): JSX.Element {
  const saveTask = useAppStore((s) => s.saveTask)
  const deleteTask = useAppStore((s) => s.deleteTask)
  const [tagDraft, setTagDraft] = useState('')
  const [readerOpen, setReaderOpen] = useState(false)

  const patch = (p: Partial<Task>): void => {
    const base = useAppStore.getState().tasks.find((t) => t.id === task.id) ?? task
    void saveTask({ ...base, ...p })
  }

  // Autosaved so closing the dialog mid-sentence never drops the text.
  const [title, setTitle] = useAutosavedText(task.title, (next) => {
    const t = next.trim()
    if (t && t !== task.title) patch({ title: t })
  })
  const [description, setDescription] = useAutosavedText(task.description ?? '', (next) =>
    patch({ description: next })
  )

  const addTag = (): void => {
    const tag = tagDraft.trim()
    if (tag && !task.tags.includes(tag)) patch({ tags: [...task.tags, tag] })
    setTagDraft('')
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
        <div className="flex items-start gap-3 border-b border-border px-6 py-4">
          <button
            onClick={() => patch({ status: task.status === 'done' ? 'todo' : 'done' })}
            className={cn(
              'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
              task.status === 'done'
                ? 'border-success bg-success text-white'
                : 'border-border hover:border-primary/60'
            )}
          >
            {task.status === 'done' && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          </button>
          <div className="min-w-0 flex-1">
            <DialogHeader className="mb-0">
              <DialogTitle className="sr-only">Editar tarefa</DialogTitle>
              <DialogDescription className="sr-only">
                Edite os detalhes e o checklist da tarefa.
              </DialogDescription>
            </DialogHeader>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => !title.trim() && setTitle(task.title)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
              className={cn(
                'no-drag w-full bg-transparent text-lg font-semibold tracking-tight focus:outline-none',
                task.status === 'done' && 'text-muted-foreground line-through'
              )}
              placeholder="Título da tarefa"
            />
          </div>
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5 scrollbar-thin">
          {/* Meta row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-sm font-medium">Status</p>
              <div className="flex gap-1.5">
                {STATUS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => patch({ status: s.id })}
                    data-on={task.status === s.id}
                    className="no-drag flex-1 rounded-lg bg-surface-elevated px-2 py-1.5 text-xs text-muted-foreground transition-colors data-[on=true]:bg-primary data-[on=true]:text-primary-foreground"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Prioridade</p>
              <div className="flex gap-1.5">
                {PRIORITY.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => patch({ priority: p.id })}
                    data-on={task.priority === p.id}
                    className={cn(
                      'no-drag flex-1 rounded-lg bg-surface-elevated px-2 py-1.5 text-xs text-muted-foreground transition-colors',
                      p.className
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Tempo estimado (min)
              </p>
              <Input
                type="number"
                min={0}
                value={task.estimatedMinutes ?? ''}
                onChange={(e) =>
                  patch({ estimatedMinutes: e.target.value ? Number(e.target.value) : undefined })
                }
                placeholder="—"
                className="h-9"
              />
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Timer className="h-3.5 w-3.5 text-muted-foreground" /> Tempo focado
              </p>
              <div className="flex h-9 items-center rounded-xl border border-border/70 bg-surface/40 px-3 text-sm tabular text-muted-foreground">
                {formatDuration(task.actualMinutes * 60)}
              </div>
            </div>
          </div>

          {/* Description — often carries a whole script over from a card, so it
              gets real room plus the same full-screen reader the cards have. */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Descrição</p>
              <button
                onClick={() => setReaderOpen(true)}
                className="no-drag flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <Maximize2 className="h-3 w-3" /> Modo leitura
              </button>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicione detalhes, links, contexto…"
              className="no-drag min-h-[280px] w-full resize-y rounded-xl border border-input bg-surface/60 px-3.5 py-2.5 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60 scrollbar-thin"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Salva sozinho · arraste o canto inferior direito para aumentar
            </p>
          </div>

          {/* Tags */}
          <div>
            <p className="mb-2 text-sm font-medium">Tags</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-lg bg-surface-elevated px-2 py-1 text-xs"
                >
                  #{tag}
                  <button
                    onClick={() => patch({ tags: task.tags.filter((x) => x !== tag) })}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {task.tags.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhuma tag.</span>
              )}
            </div>
            <Input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Adicionar tag e Enter…"
              className="h-9"
            />
          </div>

          {/* Checklist (with drag-to-reorder) */}
          <div>
            <p className="mb-2 text-sm font-medium">Checklist</p>
            <ChecklistPanel task={task} compact />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => {
              deleteTask(task.id)
              onClose()
            }}
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Excluir tarefa
          </Button>
          <Button variant="primary" onClick={onClose}>
            Concluído
          </Button>
        </div>

        {/* Inside DialogContent so Radix keeps focus here while reading. */}
        {readerOpen && (
          <ScriptReader
            title={task.title}
            value={description}
            onCommit={(next) => {
              setDescription(next)
              patch({ description: next })
            }}
            onClose={() => setReaderOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
