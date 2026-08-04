import { useEffect, useRef } from 'react'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  Clock,
  Paperclip,
  Repeat,
  Star
} from 'lucide-react'
import { DynamicIcon } from '@/components/dynamic-icon'
import { Tooltip } from '@/components/ui/tooltip'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import type { Transaction } from '@shared/finance'
import { Money } from './money'
import { useFinance } from '../hooks/use-finance'
import { groupByDay } from '../services/finance-engine'
import { relativeDayLabel } from '@/lib/dates'
import { installmentLabel } from '../services/installments-service'

const TYPE_ICON = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  transfer: ArrowLeftRight
}

/**
 * The ledger. Rows are grouped by day with a per-day subtotal, which is how
 * people actually scan a statement — "what did I do on Tuesday", not "row 47".
 */
export function TransactionList({
  transactions,
  onOpen,
  focusId,
  empty = 'Nenhuma transação por aqui.'
}: {
  transactions: Transaction[]
  onOpen: (tx: Transaction) => void
  focusId?: string
  empty?: string
}): JSX.Element {
  const groups = groupByDay(transactions)

  if (groups.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border/60 text-sm text-muted-foreground">
        {empty}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {groups.map(({ day, rows }) => {
        const net = rows.reduce((sum, t) => {
          if (t.type === 'transfer') return sum
          return sum + (t.type === 'income' ? t.amount : -t.amount)
        }, 0)
        return (
          <section key={day}>
            <header className="mb-1.5 flex items-baseline justify-between px-1">
              <h4 className="text-xs font-semibold text-muted-foreground">
                {relativeDayLabel(day)}
              </h4>
              <Money cents={net} colored sign className="text-xs" />
            </header>
            <div className="space-y-1">
              {rows.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  onOpen={onOpen}
                  highlight={tx.id === focusId}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function TransactionRow({
  transaction: tx,
  onOpen,
  highlight
}: {
  transaction: Transaction
  onOpen: (tx: Transaction) => void
  highlight?: boolean
}): JSX.Element {
  const finance = useFinance()
  const saveFinance = useAppStore((s) => s.saveFinance)
  const ref = useRef<HTMLDivElement>(null)

  // Arriving from an alert should land on the row, not near it.
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlight])

  const category = finance.categories.find((c) => c.id === tx.categoryId)
  const account = finance.accounts.find((a) => a.id === tx.accountId)
  const card = finance.cards.find((c) => c.id === tx.cardId)
  const target = finance.accounts.find((a) => a.id === tx.toAccountId)
  const Icon = TYPE_ICON[tx.type]
  const parcel = installmentLabel(tx)

  const source = card?.name ?? account?.name
  const context = tx.type === 'transfer' && target ? `${source ?? '—'} → ${target.name}` : source

  const togglePaid = (e: React.MouseEvent): void => {
    e.stopPropagation()
    void saveFinance('transactions', { ...tx, paid: !tx.paid, updatedAt: new Date().toISOString() })
  }

  return (
    <div
      ref={ref}
      onClick={() => onOpen(tx)}
      className={cn(
        'group flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-border/70 hover:bg-surface-hover/70',
        !tx.paid && 'opacity-80',
        highlight && 'border-primary/50 bg-primary/5'
      )}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: `hsl(${category?.color ?? '240 8% 60%'} / 0.15)`,
          color: `hsl(${category?.color ?? '240 8% 60%'})`
        }}
      >
        {category ? (
          <DynamicIcon name={category.icon} className="h-4 w-4" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium">{tx.description}</p>
          {parcel && (
            <span className="shrink-0 rounded-md bg-muted/60 px-1.5 py-px text-[10px] tabular text-muted-foreground">
              {parcel}
            </span>
          )}
          {tx.recurringId && (
            <Tooltip label="Gerada por uma conta fixa">
              <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" />
            </Tooltip>
          )}
          {tx.favorite && <Star className="h-3 w-3 shrink-0 fill-primary text-primary" />}
          {tx.attachment && <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {[category?.name, context].filter(Boolean).join(' · ') || 'Sem categoria'}
          {tx.tags.length > 0 && ` · ${tx.tags.map((t) => `#${t}`).join(' ')}`}
        </p>
      </div>

      {!tx.paid && (
        <button
          onClick={togglePaid}
          className="no-drag flex shrink-0 items-center gap-1 rounded-full border border-border/70 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-success/50 hover:text-success"
        >
          <Clock className="h-3 w-3" />
          {tx.type === 'income' ? 'Receber' : 'Pagar'}
        </button>
      )}
      {tx.paid && (
        <button
          onClick={togglePaid}
          className="no-drag hidden shrink-0 items-center rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground group-hover:flex"
          title="Marcar como pendente"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      )}

      <Money
        cents={tx.type === 'expense' ? -tx.amount : tx.amount}
        colored={tx.type !== 'transfer'}
        sign={tx.type === 'income'}
        className="shrink-0 text-sm font-semibold"
      />
    </div>
  )
}
