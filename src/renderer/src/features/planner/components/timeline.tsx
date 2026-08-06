import { useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { useState } from 'react'
import { KanbanSquare, Lock, MapPin } from 'lucide-react'
import { DynamicIcon } from '@/components/dynamic-icon'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '@shared/planner'
import type { BoardCard, Task } from '@shared/types'
import { type DayKey, dayLabel, parseLocal, today, weekdayLabel } from '@/lib/dates'
import { fromMinutes, nowMinutes, toMinutes } from '../utils/time'
import { taskDuration } from '../services/scheduler'
import type { AgendaLayers } from '@/stores/planner-ui-store'

/** One minute of the day is one pixel tall — an hour row is a comfortable 60px. */
const PX_PER_MINUTE = 1
/** Dropped blocks snap to this, so a shaky hand still lands on a round time. */
const SNAP_MINUTES = 15
const GUTTER = 52

interface Block {
  kind: 'task' | 'event' | 'card'
  id: string
  day: DayKey
  start: number
  end: number
  title: string
  color: string
  task?: Task
  event?: CalendarEvent
  card?: BoardCard
  locked?: boolean
}

/**
 * The day/week timeline: real time blocking, where a two-hour task occupies
 * two hours of screen.
 *
 * Dragging computes the new time from the pointer delta rather than from a mesh
 * of drop zones — one droppable per day instead of one per fifteen minutes,
 * which keeps a week view at seven drop targets rather than several hundred.
 */
export function Timeline({
  days,
  layers,
  onOpenTask,
  onOpenEvent,
  onOpenCard,
  onCreate
}: {
  days: DayKey[]
  layers: AgendaLayers
  onOpenTask: (task: Task) => void
  onOpenEvent: (event: CalendarEvent) => void
  onOpenCard?: (card: BoardCard) => void
  onCreate?: (day: DayKey, startTime: string) => void
}): JSX.Element {
  const tasks = useAppStore((s) => s.tasks)
  const events = useAppStore((s) => s.events)
  const cards = useAppStore((s) => s.cards)
  const boards = useAppStore((s) => s.boards)
  const saveCard = useAppStore((s) => s.saveCard)
  const settings = useAppStore((s) => s.planner)
  const saveTask = useAppStore((s) => s.saveTask)
  const savePlanner = useAppStore((s) => s.savePlanner)
  const [dragging, setDragging] = useState<Block | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // The window shown: the planning day, widened to fit anything outside it.
  const { from, to } = useMemo(() => {
    let start = toMinutes(settings.dayStart)
    let end = toMinutes(settings.dayEnd)
    for (const task of tasks) {
      if (task.cardId) continue
      if (!days.includes(task.scheduledDate ?? '') || !task.startTime) continue
      start = Math.min(start, toMinutes(task.startTime))
      end = Math.max(end, toMinutes(task.startTime) + taskDuration(task, settings))
    }
    for (const event of events) {
      if (!days.includes(event.date) || event.allDay) continue
      start = Math.min(start, toMinutes(event.startTime))
      end = Math.max(end, toMinutes(event.endTime))
    }
    for (const card of cards) {
      if (!card.dueDate || !days.includes(card.dueDate) || !card.dueTime) continue
      start = Math.min(start, toMinutes(card.dueTime))
      end = Math.max(end, toMinutes(card.dueTime) + (card.durationMinutes ?? 60))
    }
    return { from: Math.floor(start / 60) * 60, to: Math.ceil(end / 60) * 60 }
  }, [tasks, events, cards, days, settings])

  const height = Math.max(240, (to - from) * PX_PER_MINUTE)

  const blocks = useMemo(() => {
    const out: Block[] = []
    if (layers.tasks) {
      for (const task of tasks) {
        // A card's internal steps never get their own block.
        if (task.cardId) continue
        if (!task.scheduledDate || !days.includes(task.scheduledDate) || !task.startTime) continue
        const start = toMinutes(task.startTime)
        out.push({
          kind: 'task',
          id: task.id,
          day: task.scheduledDate,
          start,
          end: start + taskDuration(task, settings),
          title: task.title,
          color: task.status === 'done' ? '152 62% 47%' : '250 82% 68%',
          task,
          locked: task.pinned
        })
      }
    }
    if (layers.events) {
      for (const event of events) {
        if (!days.includes(event.date) || event.allDay) continue
        out.push({
          kind: 'event',
          id: event.id,
          day: event.date,
          start: toMinutes(event.startTime),
          end: toMinutes(event.endTime),
          title: event.title,
          color: event.color,
          event
        })
      }
    }
    if (layers.cards) {
      for (const card of cards) {
        if (!card.dueDate || !days.includes(card.dueDate) || !card.dueTime) continue
        const board = boards.find((b) => b.id === card.boardId)
        const start = toMinutes(card.dueTime)
        out.push({
          kind: 'card',
          id: card.id,
          day: card.dueDate,
          start,
          end: start + (card.durationMinutes ?? 60),
          title: card.title,
          color: board?.color ?? '270 80% 66%',
          card
        })
      }
    }
    return out
  }, [tasks, events, cards, boards, days, layers, settings])

  const onDragEnd = (e: DragEndEvent): void => {
    setDragging(null)
    const block = blocks.find((b) => b.id === e.active.id)
    if (!block) return

    const targetDay = (e.over?.id as string | undefined)?.replace('day-', '') ?? block.day
    const movedMinutes = Math.round(e.delta.y / PX_PER_MINUTE / SNAP_MINUTES) * SNAP_MINUTES
    if (movedMinutes === 0 && targetDay === block.day) return

    const duration = block.end - block.start
    const start = Math.max(0, Math.min(24 * 60 - duration, block.start + movedMinutes))

    if (block.task) {
      void saveTask({
        ...block.task,
        scheduledDate: targetDay,
        startTime: fromMinutes(start),
        // Moving something by hand is a decision — auto-planning respects it.
        pinned: true,
        updatedAt: new Date().toISOString()
      })
    } else if (block.card) {
      void saveCard({
        ...block.card,
        dueDate: targetDay,
        dueTime: fromMinutes(start),
        updatedAt: new Date().toISOString()
      })
    } else if (block.event) {
      void savePlanner('events', {
        ...block.event,
        date: targetDay,
        startTime: fromMinutes(start),
        endTime: fromMinutes(start + duration),
        updatedAt: new Date().toISOString()
      })
    }
  }

  const hours = Array.from({ length: Math.ceil((to - from) / 60) + 1 }, (_, i) => from + i * 60)
  const untimedByDay = days.map((day) =>
    layers.cards ? cards.filter((c) => c.dueDate === day && !c.dueTime) : []
  )

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) =>
        setDragging(blocks.find((b) => b.id === e.active.id) ?? null)
      }
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="overflow-hidden rounded-xl border border-border/60">
        {/* Day headers — one row, so every column starts at the same height. */}
        <div className="flex border-b border-border/60 bg-surface/40">
          <div className="shrink-0" style={{ width: GUTTER }} />
          {days.map((day) => (
            <DayHeader key={day} day={day} single={days.length === 1} />
          ))}
        </div>

        {/*
          All-day strip. This used to live inside each column, which pushed the
          grid down only on the days that had something — and the hour lines
          stopped matching across the week. One shared row keeps them aligned.
        */}
        {untimedByDay.some((list) => list.length > 0) && (
          <div className="flex border-b border-border/60 bg-surface/20">
            <div
              className="shrink-0 py-1.5 pr-2 text-right text-[10px] leading-tight text-muted-foreground"
              style={{ width: GUTTER }}
            >
              sem
              <br />
              hora
            </div>
            {days.map((day, i) => (
              <div
                key={day}
                className={cn(
                  'min-w-0 flex-1 space-y-1 border-l border-border/40 p-1.5',
                  day === today() && 'bg-primary/[0.04]'
                )}
              >
                {untimedByDay[i].map((card) => (
                  <button
                    key={card.id}
                    onClick={() => onOpenCard?.(card)}
                    className="no-drag block w-full truncate rounded-md bg-primary/15 px-1.5 py-1 text-left text-[10px] font-medium text-primary transition-colors hover:bg-primary/25"
                    title={`${card.title} · entrega sem horário definido`}
                  >
                    {card.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="flex">
          <div className="relative shrink-0" style={{ width: GUTTER, height }}>
            {hours.map((minute) => (
              <span
                key={minute}
                className="absolute right-2 text-[10px] tabular leading-none text-muted-foreground"
                // Sitting just under its line keeps the first label from being
                // clipped by the row above.
                style={{ top: (minute - from) * PX_PER_MINUTE + 3 }}
              >
                {fromMinutes(minute)}
              </span>
            ))}
          </div>

          <div className="flex min-w-0 flex-1">
            {days.map((day) => (
              <DayColumn
                key={day}
                day={day}
                from={from}
                to={to}
                height={height}
                hours={hours}
                blocks={blocks.filter((b) => b.day === day)}
                onOpenTask={onOpenTask}
                onOpenEvent={onOpenEvent}
                onOpenCard={onOpenCard}
                onCreate={onCreate}
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div
            className="rounded-lg border px-2 py-1 text-xs shadow-elevated"
            style={{
              background: `hsl(${dragging.color} / 0.9)`,
              borderColor: `hsl(${dragging.color})`,
              color: 'white',
              height: (dragging.end - dragging.start) * PX_PER_MINUTE
            }}
          >
            {dragging.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

/** Weekday + day number. Today gets a pill so the eye lands on it first. */
function DayHeader({ day, single }: { day: DayKey; single: boolean }): JSX.Element {
  const isToday = day === today()
  const weekend = [0, 6].includes(parseLocal(day).getDay())

  return (
    <div
      className={cn(
        'min-w-0 flex-1 border-l border-border/40 py-2 text-center',
        weekend && 'bg-muted/[0.15]',
        isToday && 'bg-primary/[0.06]'
      )}
    >
      {!single && (
        <div
          className={cn(
            'text-[10px] uppercase tracking-wide',
            isToday ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {weekdayLabel(day)}
        </div>
      )}
      <div
        className={cn(
          'mx-auto mt-0.5 w-fit rounded-md px-1.5 text-sm tabular',
          isToday ? 'bg-primary font-semibold text-primary-foreground' : 'text-foreground'
        )}
      >
        {single ? dayLabel(day) : Number(day.slice(8))}
      </div>
    </div>
  )
}

function DayColumn({
  day,
  from,
  to,
  height,
  hours,
  blocks,
  onOpenTask,
  onOpenEvent,
  onOpenCard,
  onCreate
}: {
  day: DayKey
  from: number
  to: number
  height: number
  hours: number[]
  blocks: Block[]
  onOpenTask: (task: Task) => void
  onOpenEvent: (event: CalendarEvent) => void
  onOpenCard?: (card: BoardCard) => void
  onCreate?: (day: DayKey, startTime: string) => void
}): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` })
  const isToday = day === today()
  const weekend = [0, 6].includes(parseLocal(day).getDay())
  const now = nowMinutes()
  const lanes = assignLanes(blocks)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative min-w-0 flex-1 border-l border-border/40 transition-colors',
        weekend && 'bg-muted/[0.12]',
        isToday && 'bg-primary/[0.03]',
        isOver && 'bg-primary/[0.08]'
      )}
      style={{ height }}
      onDoubleClick={(e) => {
        if (!onCreate) return
        const box = e.currentTarget.getBoundingClientRect()
        const minute = from + Math.round((e.clientY - box.top) / PX_PER_MINUTE / 30) * 30
        onCreate(day, fromMinutes(minute))
      }}
    >
      {/* Hour lines. The half-hour is fainter, so the eye reads whole hours. */}
      {hours.map((minute) => (
        <div key={minute}>
          <div
            className="pointer-events-none absolute left-0 right-0 border-t border-border/40"
            style={{ top: (minute - from) * PX_PER_MINUTE }}
          />
          {minute + 30 <= to && (
            <div
              className="pointer-events-none absolute left-0 right-0 border-t border-border/15"
              style={{ top: (minute - from + 30) * PX_PER_MINUTE }}
            />
          )}
        </div>
      ))}

      {isToday && now >= from && now <= to && (
        <div
          className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
          style={{ top: (now - from) * PX_PER_MINUTE }}
        >
          <span className="-ml-[3px] h-1.5 w-1.5 rounded-full bg-destructive" />
          <span className="h-px flex-1 bg-destructive/60" />
        </div>
      )}

      {blocks.map((block) => (
        <TimelineBlock
          key={block.id}
          block={block}
          from={from}
          lane={lanes.get(block.id) ?? { index: 0, total: 1 }}
          onOpen={() => {
            if (block.task) onOpenTask(block.task)
            else if (block.event) onOpenEvent(block.event)
            else if (block.card) onOpenCard?.(block.card)
          }}
        />
      ))}
    </div>
  )
}

function TimelineBlock({
  block,
  from,
  lane,
  onOpen
}: {
  block: Block
  from: number
  lane: { index: number; total: number }
  onOpen: () => void
}): JSX.Element {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: block.id })
  const minutes = block.end - block.start
  const width = 100 / lane.total

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      className={cn(
        'group absolute flex cursor-grab flex-col overflow-hidden rounded-md text-left shadow-sm transition-shadow hover:shadow-elevated active:cursor-grabbing',
        isDragging && 'opacity-30'
      )}
      style={{
        top: (block.start - from) * PX_PER_MINUTE + 1,
        height: Math.max(16, minutes * PX_PER_MINUTE - 2),
        left: `calc(${lane.index * width}% + 3px)`,
        width: `calc(${width}% - 6px)`,
        background: `hsl(${block.color} / 0.18)`,
        // A solid left edge reads as a colour code without shouting.
        borderLeft: `3px solid hsl(${block.color})`
      }}
    >
      <div className="flex items-center gap-1 px-1.5 pt-1">
        {block.locked && <Lock className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />}
        {block.kind === 'card' && <KanbanSquare className="h-2.5 w-2.5 shrink-0 opacity-70" />}
        {block.event?.icon && (
          <DynamicIcon name={block.event.icon} className="h-2.5 w-2.5 shrink-0 opacity-70" />
        )}
        <span
          className={cn(
            'truncate text-[11px] font-medium leading-tight',
            block.task?.status === 'done' && 'line-through opacity-60'
          )}
        >
          {block.title}
        </span>
      </div>
      {minutes >= 45 && (
        <p className="truncate px-1.5 text-[10px] tabular leading-tight text-muted-foreground">
          {fromMinutes(block.start)}–{fromMinutes(block.end)}
        </p>
      )}
      {minutes >= 75 && block.event?.location && (
        <p className="flex items-center gap-0.5 truncate px-1.5 text-[10px] text-muted-foreground">
          <MapPin className="h-2.5 w-2.5" /> {block.event.location}
        </p>
      )}
    </div>
  )
}

/**
 * Side-by-side placement for blocks that overlap in time, so a double-booked
 * hour shows both instead of hiding one behind the other.
 */
function assignLanes(blocks: Block[]): Map<string, { index: number; total: number }> {
  const result = new Map<string, { index: number; total: number }>()
  const sorted = [...blocks].sort((a, b) => a.start - b.start || a.end - b.end)

  let cluster: Block[] = []
  let clusterEnd = -1

  const flush = (): void => {
    if (cluster.length === 0) return
    const lanes: number[] = [] // end time of the last block in each lane
    const assigned = new Map<string, number>()
    for (const block of cluster) {
      let lane = lanes.findIndex((end) => end <= block.start)
      if (lane === -1) {
        lane = lanes.length
        lanes.push(block.end)
      } else {
        lanes[lane] = block.end
      }
      assigned.set(block.id, lane)
    }
    for (const block of cluster) {
      result.set(block.id, { index: assigned.get(block.id) ?? 0, total: lanes.length })
    }
    cluster = []
  }

  for (const block of sorted) {
    if (cluster.length > 0 && block.start >= clusterEnd) flush()
    cluster.push(block)
    clusterEnd = Math.max(clusterEnd, block.end)
  }
  flush()
  return result
}
