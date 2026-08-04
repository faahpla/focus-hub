import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, Target } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useFinanceUi } from '@/stores/finance-ui-store'
import { cn } from '@/lib/utils'
import type { Transaction } from '@shared/finance'
import { Money } from '../components/money'
import { TransactionDialog } from '../components/transaction-dialog'
import { TransactionList } from '../components/transaction-list'
import { useFinance } from '../hooks/use-finance'
import { cardUsage } from '../services/finance-engine'
import {
  type DayKey,
  WEEKDAY_NAMES_SHORT,
  dayInMonth,
  daysInMonth,
  monthLabel,
  relativeDayLabel,
  today
} from '../utils/dates'

interface DayEvent {
  kind: 'transaction' | 'invoice' | 'goal'
  label: string
  amount: number
  income?: boolean
  pending?: boolean
}

/**
 * The month at a glance: what leaves, what arrives, when the invoices close and
 * when a goal's deadline lands. Clicking a day opens everything on it.
 */
export function CalendarPage(): JSX.Element {
  const finance = useFinance()
  const month = useFinanceUi((s) => s.month)
  const [selected, setSelected] = useState<DayKey | null>(null)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const events = useMemo(() => {
    const map = new Map<DayKey, DayEvent[]>()
    const push = (day: DayKey, event: DayEvent): void => {
      if (!day.startsWith(month)) return
      const list = map.get(day) ?? []
      list.push(event)
      map.set(day, list)
    }

    for (const tx of finance.transactions) {
      push(tx.date, {
        kind: 'transaction',
        label: tx.description,
        amount: tx.amount,
        income: tx.type === 'income',
        pending: !tx.paid
      })
    }
    for (const card of finance.cards.filter((c) => !c.archived)) {
      for (const invoice of cardUsage(card, finance.transactions).invoices) {
        if (invoice.total <= 0) continue
        push(invoice.dueDate, {
          kind: 'invoice',
          label: `Fatura ${card.name}`,
          amount: invoice.total,
          pending: !invoice.paid
        })
      }
    }
    for (const goal of finance.goals.filter((g) => !g.archived && g.deadline)) {
      push(goal.deadline!, {
        kind: 'goal',
        label: `Meta: ${goal.name}`,
        amount: Math.max(0, goal.targetAmount - goal.currentAmount)
      })
    }
    return map
  }, [finance, month])

  const [year, monthIndex] = month.split('-').map(Number)
  const total = daysInMonth(year, monthIndex - 1)
  const firstWeekday = new Date(year, monthIndex - 1, 1).getDay()
  const cells: (DayKey | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: total }, (_, i) => dayInMonth(month, i + 1))
  ]

  const todayKey = today()
  const dayRows = selected
    ? finance.transactions.filter((t) => t.date === selected)
    : []

  const monthIn = Array.from(events.values())
    .flat()
    .filter((e) => e.kind === 'transaction' && e.income)
    .reduce((s, e) => s + e.amount, 0)
  const monthOut = Array.from(events.values())
    .flat()
    .filter((e) => e.kind === 'transaction' && !e.income)
    .reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-5 px-8 pb-24">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">{monthLabel(month, true)}</h3>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>
              Entradas <Money cents={monthIn} className="text-success" />
            </span>
            <span>
              Saídas <Money cents={monthOut} className="text-destructive" />
            </span>
          </div>
        </div>

        <div className="mb-1.5 grid grid-cols-7 gap-1.5">
          {WEEKDAY_NAMES_SHORT.map((day) => (
            <div key={day} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} />
            const dayEvents = events.get(day) ?? []
            const income = dayEvents.filter((e) => e.income).reduce((s, e) => s + e.amount, 0)
            const expense = dayEvents
              .filter((e) => e.kind === 'transaction' && !e.income)
              .reduce((s, e) => s + e.amount, 0)
            const hasPending = dayEvents.some((e) => e.pending)
            const hasInvoice = dayEvents.some((e) => e.kind === 'invoice')
            const hasGoal = dayEvents.some((e) => e.kind === 'goal')

            return (
              <motion.button
                key={day}
                whileHover={{ scale: dayEvents.length > 0 ? 1.02 : 1 }}
                onClick={() => setSelected(selected === day ? null : day)}
                className={cn(
                  'flex min-h-[4.75rem] flex-col rounded-xl border p-1.5 text-left transition-colors',
                  day === todayKey
                    ? 'border-primary/50 bg-primary/[0.06]'
                    : 'border-border/50 bg-surface/40',
                  selected === day && 'border-primary bg-primary/10',
                  dayEvents.length > 0 && 'hover:bg-surface-hover'
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'text-[11px] tabular',
                      day === todayKey ? 'font-semibold text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  <span className="flex gap-0.5">
                    {hasInvoice && <CreditCard className="h-2.5 w-2.5 text-muted-foreground" />}
                    {hasGoal && <Target className="h-2.5 w-2.5 text-primary" />}
                    {hasPending && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[hsl(45_90%_58%)]" />
                    )}
                  </span>
                </div>

                <div className="mt-auto space-y-0.5">
                  {income > 0 && (
                    <Money cents={income} compact className="block text-[10px] text-success" />
                  )}
                  {expense > 0 && (
                    <Money cents={expense} compact className="block text-[10px] text-destructive" />
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>
      </Card>

      {selected && (
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold">{relativeDayLabel(selected)}</h3>

          {(events.get(selected) ?? [])
            .filter((e) => e.kind !== 'transaction')
            .map((event, i) => (
              <div
                key={`${event.kind}-${i}`}
                className="mb-2 flex items-center gap-2.5 rounded-xl border border-border/60 bg-surface/40 p-3"
              >
                {event.kind === 'invoice' ? (
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Target className="h-4 w-4 text-primary" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm">{event.label}</span>
                <Money cents={event.amount} className="text-sm font-medium" />
              </div>
            ))}

          <TransactionList
            transactions={dayRows}
            onOpen={setEditingTx}
            empty="Nada lançado neste dia."
          />
        </Card>
      )}

      {editingTx && <TransactionDialog transaction={editingTx} onClose={() => setEditingTx(null)} />}
    </div>
  )
}
