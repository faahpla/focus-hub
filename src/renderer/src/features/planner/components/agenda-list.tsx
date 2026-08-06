import { useMemo } from 'react'
import { CircleDollarSign, KanbanSquare } from 'lucide-react'
import { DynamicIcon } from '@/components/dynamic-icon'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '@shared/planner'
import type { BoardCard, Task } from '@shared/types'
import { type DayKey, addDaysToKey, daysBetween, relativeDayLabel, today } from '@/lib/dates'
import { formatMoney } from '@/features/finance/utils/money'
import { cardUsage } from '@/features/finance/services/finance-engine'
import type { AgendaLayers } from '@/stores/planner-ui-store'
import { TaskRow } from './task-row'

/** How far ahead the list looks. */
const HORIZON_DAYS = 30

interface Entry {
  kind: 'task' | 'event' | 'finance' | 'card'
  sort: string
  task?: Task
  event?: CalendarEvent
  card?: BoardCard
  finance?: { label: string; amount: number; income: boolean }
}

/**
 * Everything ahead, in one scrollable stream. The view that answers "what is
 * coming?" without asking the user to hop between weeks.
 */
export function AgendaList({
  day,
  layers,
  onOpenTask,
  onOpenEvent,
  onOpenCard
}: {
  day: DayKey
  layers: AgendaLayers
  onOpenTask: (task: Task) => void
  onOpenEvent: (event: CalendarEvent) => void
  onOpenCard?: (card: BoardCard) => void
}): JSX.Element {
  const tasks = useAppStore((s) => s.tasks)
  const events = useAppStore((s) => s.events)
  const cards = useAppStore((s) => s.cards)
  const finance = useAppStore((s) => s.finance)

  const groups = useMemo(() => {
    const from = day < today() ? day : today()
    const to = addDaysToKey(from, HORIZON_DAYS)
    const map = new Map<DayKey, Entry[]>()
    const push = (key: DayKey, entry: Entry): void => {
      if (key < from || key > to) return
      const list = map.get(key) ?? []
      list.push(entry)
      map.set(key, list)
    }

    if (layers.tasks) {
      for (const task of tasks) {
        if (!task.scheduledDate || task.status === 'done') continue
        push(task.scheduledDate, { kind: 'task', sort: task.startTime ?? '99:99', task })
      }
    }
    if (layers.cards) {
      for (const card of cards) {
        if (!card.dueDate) continue
        push(card.dueDate, { kind: 'card', sort: card.dueTime ?? '97:00', card })
      }
    }
    if (layers.events) {
      for (const event of events) {
        push(event.date, {
          kind: 'event',
          sort: event.allDay ? '00:00' : event.startTime,
          event
        })
      }
    }
    if (layers.finance) {
      for (const tx of finance.transactions) {
        if (tx.paid || tx.type === 'transfer') continue
        push(tx.date, {
          kind: 'finance',
          sort: '98:00',
          finance: { label: tx.description, amount: tx.amount, income: tx.type === 'income' }
        })
      }
      for (const card of finance.cards.filter((c) => !c.archived)) {
        for (const invoice of cardUsage(card, finance.transactions).invoices) {
          if (invoice.paid || invoice.total <= 0) continue
          push(invoice.dueDate, {
            kind: 'finance',
            sort: '98:30',
            finance: { label: `Fatura ${card.name}`, amount: invoice.total, income: false }
          })
        }
      }
    }

    return daysBetween(from, to)
      .filter((d) => map.has(d))
      .map((d) => ({
        day: d,
        entries: (map.get(d) ?? []).sort((a, b) => a.sort.localeCompare(b.sort))
      }))
  }, [tasks, events, cards, finance, layers, day])

  if (groups.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border/60 text-sm text-muted-foreground">
        Nada agendado nos próximos {HORIZON_DAYS} dias.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {groups.map(({ day: groupDay, entries }) => (
        <section key={groupDay}>
          <h3
            className={cn(
              'mb-1.5 px-1 text-xs font-semibold',
              groupDay === today() ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {relativeDayLabel(groupDay)}
          </h3>
          <div className="space-y-1">
            {entries.map((entry, i) => {
              if (entry.task) {
                return (
                  <TaskRow key={entry.task.id} task={entry.task} onOpen={onOpenTask} />
                )
              }
              if (entry.event) {
                const event = entry.event
                return (
                  <button
                    key={event.id}
                    onClick={() => onOpenEvent(event)}
                    className="no-drag flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-hover/70"
                    style={{ background: `hsl(${event.color} / 0.06)` }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: `hsl(${event.color} / 0.15)`,
                        color: `hsl(${event.color})`
                      }}
                    >
                      <DynamicIcon name={event.icon ?? 'CalendarDays'} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{event.title}</p>
                      {event.location && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {event.location}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs tabular text-muted-foreground">
                      {event.allDay ? 'dia todo' : `${event.startTime}–${event.endTime}`}
                    </span>
                  </button>
                )
              }
              if (entry.card) {
                const card = entry.card
                return (
                  <button
                    key={card.id}
                    onClick={() => onOpenCard?.(card)}
                    className="no-drag flex w-full items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.05] px-3 py-2.5 text-left transition-colors hover:bg-primary/10"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <KanbanSquare className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{card.title}</p>
                      <p className="text-[11px] text-muted-foreground">Entrega</p>
                    </div>
                    <span className="shrink-0 text-xs tabular text-muted-foreground">
                      {card.dueTime ?? 'sem hora'}
                    </span>
                  </button>
                )
              }
              const money = entry.finance!
              return (
                <div
                  key={`fin-${groupDay}-${i}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                    <CircleDollarSign className="h-4 w-4" />
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm">{money.label}</p>
                  <span
                    className={cn(
                      'shrink-0 text-sm tabular font-medium',
                      money.income ? 'text-success' : 'text-destructive'
                    )}
                  >
                    {formatMoney(money.income ? money.amount : -money.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}