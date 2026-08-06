import { useMemo } from 'react'
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { CircleDollarSign } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '@shared/planner'
import { isChecked } from '@shared/planner'
import type { BoardCard, Task } from '@shared/types'
import { type DayKey, WEEKDAY_NAMES_MONDAY, monthGrid, today } from '@/lib/dates'
import { cardUsage } from '@/features/finance/services/finance-engine'
import type { AgendaLayers } from '@/stores/planner-ui-store'
import { isDueOn } from '../services/habits-service'

interface Chip {
  id: string
  label: string
  color: string
  kind: 'task' | 'event' | 'finance' | 'card'
  done?: boolean
  task?: Task
  event?: CalendarEvent
  card?: BoardCard
}

/** The month at a glance. Dragging a task here changes its day, not its time. */
export function MonthGrid({
  month,
  layers,
  onOpenTask,
  onOpenEvent,
  onOpenCard,
  onPickDay
}: {
  month: string
  layers: AgendaLayers
  onOpenTask: (task: Task) => void
  onOpenEvent: (event: CalendarEvent) => void
  onOpenCard?: (card: BoardCard) => void
  onPickDay: (day: DayKey) => void
}): JSX.Element {
  const tasks = useAppStore((s) => s.tasks)
  const events = useAppStore((s) => s.events)
  const cards = useAppStore((s) => s.cards)
  const boards = useAppStore((s) => s.boards)
  const habits = useAppStore((s) => s.habits)
  const finance = useAppStore((s) => s.finance)
  const saveTask = useAppStore((s) => s.saveTask)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const cells = useMemo(() => monthGrid(month), [month])

  const chipsByDay = useMemo(() => {
    const map = new Map<DayKey, Chip[]>()
    const push = (day: DayKey, chip: Chip): void => {
      const list = map.get(day) ?? []
      list.push(chip)
      map.set(day, list)
    }

    if (layers.tasks) {
      for (const task of tasks) {
        if (task.cardId || !task.scheduledDate) continue
        push(task.scheduledDate, {
          id: task.id,
          label: task.title,
          color: task.status === 'done' ? '152 62% 47%' : '250 82% 68%',
          kind: 'task',
          done: task.status === 'done',
          task
        })
      }
    }
    if (layers.cards) {
      for (const card of cards) {
        if (!card.dueDate) continue
        const board = boards.find((b) => b.id === card.boardId)
        push(card.dueDate, {
          id: `card-${card.id}`,
          label: card.dueTime ? `${card.dueTime} ${card.title}` : card.title,
          color: board?.color ?? '270 80% 66%',
          kind: 'card',
          card
        })
      }
    }
    if (layers.events) {
      for (const event of events) {
        push(event.date, {
          id: event.id,
          label: event.title,
          color: event.color,
          kind: 'event',
          event
        })
      }
    }
    if (layers.finance) {
      for (const tx of finance.transactions) {
        if (tx.paid || tx.type === 'transfer') continue
        push(tx.date, {
          id: `tx-${tx.id}`,
          label: tx.description,
          color: tx.type === 'income' ? '152 62% 47%' : '0 72% 60%',
          kind: 'finance'
        })
      }
      for (const card of finance.cards.filter((c) => !c.archived)) {
        for (const invoice of cardUsage(card, finance.transactions).invoices) {
          if (invoice.paid || invoice.total <= 0) continue
          push(invoice.dueDate, {
            id: `inv-${card.id}-${invoice.month}`,
            label: `Fatura ${card.name}`,
            color: '0 72% 60%',
            kind: 'finance'
          })
        }
      }
    }
    return map
  }, [tasks, events, cards, boards, finance, layers])

  const habitLoad = useMemo(() => {
    if (!layers.habits) return new Map<DayKey, { done: number; due: number }>()
    const map = new Map<DayKey, { done: number; due: number }>()
    const active = habits.filter((h) => !h.archived)
    for (const day of cells) {
      const due = active.filter((h) => isDueOn(h, day))
      if (due.length === 0) continue
      map.set(day, { due: due.length, done: due.filter((h) => isChecked(h, day)).length })
    }
    return map
  }, [habits, cells, layers.habits])

  const onDragEnd = (e: DragEndEvent): void => {
    const targetDay = (e.over?.id as string | undefined)?.replace('m-', '')
    if (!targetDay) return
    const task = tasks.find((t) => t.id === e.active.id)
    if (!task || task.scheduledDate === targetDay) return
    void saveTask({
      ...task,
      scheduledDate: targetDay,
      // The hour that made sense on another day rarely survives the move.
      startTime: undefined,
      pinned: false,
      updatedAt: new Date().toISOString()
    })
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_NAMES_MONDAY.map((name) => (
          <div key={name} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
            {name}
          </div>
        ))}

        {cells.map((day) => (
          <MonthCell
            key={day}
            day={day}
            month={month}
            chips={chipsByDay.get(day) ?? []}
            habits={habitLoad.get(day)}
            onOpenTask={onOpenTask}
            onOpenEvent={onOpenEvent}
            onOpenCard={onOpenCard}
            onPickDay={onPickDay}
          />
        ))}
      </div>
    </DndContext>
  )
}

function MonthCell({
  day,
  month,
  chips,
  habits,
  onOpenTask,
  onOpenEvent,
  onOpenCard,
  onPickDay
}: {
  day: DayKey
  month: string
  chips: Chip[]
  habits?: { done: number; due: number }
  onOpenTask: (task: Task) => void
  onOpenEvent: (event: CalendarEvent) => void
  onOpenCard?: (card: BoardCard) => void
  onPickDay: (day: DayKey) => void
}): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: `m-${day}` })
  const inMonth = day.startsWith(month)
  const isToday = day === today()
  const shown = chips.slice(0, 3)

  return (
    <div
      ref={setNodeRef}
      onDoubleClick={() => onPickDay(day)}
      className={cn(
        'flex min-h-[6.5rem] flex-col gap-1 rounded-xl border p-1.5 transition-colors',
        isToday
          ? 'border-primary/50 bg-primary/[0.06]'
          : inMonth
            ? 'border-border/50 bg-surface/40'
            : 'border-transparent bg-surface/20 opacity-50',
        isOver && 'border-primary bg-primary/10'
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-[11px] tabular',
            isToday ? 'font-semibold text-primary' : 'text-muted-foreground'
          )}
        >
          {Number(day.slice(8))}
        </span>
        {habits && habits.due > 0 && (
          <span
            className={cn(
              'text-[9px] tabular',
              habits.done === habits.due ? 'text-success' : 'text-muted-foreground'
            )}
            title={`${habits.done}/${habits.due} hábitos`}
          >
            {habits.done}/{habits.due}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5">
        {shown.map((chip) =>
          chip.task ? (
            <DraggableChip key={chip.id} chip={chip} onOpen={() => onOpenTask(chip.task!)} />
          ) : (
            <button
              key={chip.id}
              onClick={() => {
                if (chip.event) onOpenEvent(chip.event)
                else if (chip.card) onOpenCard?.(chip.card)
              }}
              className="no-drag flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px]"
              style={{ background: `hsl(${chip.color} / 0.14)`, color: `hsl(${chip.color})` }}
            >
              {chip.kind === 'finance' && <CircleDollarSign className="h-2.5 w-2.5 shrink-0" />}
              <span className="truncate">{chip.label}</span>
            </button>
          )
        )}
        {chips.length > shown.length && (
          <button
            onClick={() => onPickDay(day)}
            className="no-drag px-1 text-left text-[10px] text-muted-foreground hover:text-foreground"
          >
            +{chips.length - shown.length} mais
          </button>
        )}
      </div>
    </div>
  )
}

function DraggableChip({ chip, onOpen }: { chip: Chip; onOpen: () => void }): JSX.Element {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: chip.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      className={cn(
        'cursor-grab truncate rounded px-1 py-0.5 text-[10px] active:cursor-grabbing',
        chip.done && 'line-through opacity-60',
        isDragging && 'opacity-40'
      )}
      style={{ background: `hsl(${chip.color} / 0.14)`, color: `hsl(${chip.color})` }}
    >
      {chip.label}
    </div>
  )
}
