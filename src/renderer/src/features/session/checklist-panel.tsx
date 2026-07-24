import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Task } from '@shared/types'
import { SortableList, SortableItem, DragHandle } from '@/components/ui/sortable'
import { useAppStore } from '@/stores/app-store'
import { uid } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function ChecklistPanel({ task, compact }: { task: Task; compact?: boolean }): JSX.Element {
  const saveTask = useAppStore((s) => s.saveTask)
  const [draft, setDraft] = useState('')

  const done = task.checklist.filter((c) => c.done).length
  const total = task.checklist.length

  const toggle = (id: string): void => {
    void saveTask({
      ...task,
      checklist: task.checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c))
    })
  }

  const add = (): void => {
    const label = draft.trim()
    if (!label) return
    void saveTask({
      ...task,
      checklist: [...task.checklist, { id: uid(), label, done: false }]
    })
    setDraft('')
  }

  const remove = (id: string): void => {
    void saveTask({ ...task, checklist: task.checklist.filter((c) => c.id !== id) })
  }

  const reorder = (ids: string[]): void => {
    const byId = new Map(task.checklist.map((c) => [c.id, c]))
    const checklist = ids.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c)
    void saveTask({ ...task, checklist })
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/70 bg-surface/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Checklist</span>
        <span className="text-xs tabular text-muted-foreground">
          {done}/{total}
        </span>
      </div>
      <div className={cn('flex-1 overflow-y-auto scrollbar-thin', compact && 'max-h-64')}>
        <SortableList ids={task.checklist.map((c) => c.id)} onReorder={reorder}>
          {task.checklist.map((item) => (
            <SortableItem
              key={item.id}
              id={item.id}
              className="no-drag group flex items-center gap-1.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-surface-hover"
            >
              <DragHandle className="opacity-0 group-hover:opacity-100" />
              <button
                onClick={() => toggle(item.id)}
                className="flex flex-1 items-center gap-2.5 text-left"
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors',
                    item.done
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border group-hover:border-primary/50'
                  )}
                >
                  {item.done && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </motion.span>
                  )}
                </span>
                <span
                  className={cn(
                    'text-sm transition-colors',
                    item.done ? 'text-muted-foreground line-through' : 'text-foreground'
                  )}
                >
                  {item.label}
                </span>
              </button>
              <button
                onClick={() => remove(item.id)}
                className="shrink-0 text-muted-foreground/50 opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </SortableItem>
          ))}
        </SortableList>
        {total === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            Nenhum item ainda.
          </p>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5 border-t border-border/60 pt-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Adicionar item…"
          className="no-drag h-8 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <button
          onClick={add}
          className="no-drag flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
