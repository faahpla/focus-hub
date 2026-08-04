import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, Plus, Receipt } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { useAppStore } from '@/stores/app-store'
import { useFinanceUi } from '@/stores/finance-ui-store'
import { useToastStore } from '@/stores/toast-store'
import { uid } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { CardInvoice } from '../services/finance-engine'
import type { FinanceCard, Transaction } from '@shared/finance'
import { CARD_BRAND_LABEL } from '@shared/finance'
import { Money } from '../components/money'
import { CardDialog } from '../components/card-dialog'
import { TransactionDialog } from '../components/transaction-dialog'
import { TransactionList } from '../components/transaction-list'
import { useFinance } from '../hooks/use-finance'
import { cardUsage } from '../services/finance-engine'
import { formatPercent } from '../utils/money'
import { dayLabel, monthLabel, today } from '@/lib/dates'

export function CardsPage(): JSX.Element {
  const finance = useFinance()
  const saveFinance = useAppStore((s) => s.saveFinance)
  const pushToast = useToastStore((s) => s.push)
  const focusId = useFinanceUi((s) => s.focusId)

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<FinanceCard | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? null)
  const [spending, setSpending] = useState<string | null>(null)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const cards = useMemo(
    () =>
      finance.cards
        .filter((c) => !c.archived)
        .sort((a, b) => a.order - b.order)
        .map((card) => ({ card, usage: cardUsage(card, finance.transactions) })),
    [finance]
  )

  const selected = cards.find((c) => c.card.id === selectedId) ?? cards[0]

  /**
   * Paying an invoice settles its rows and records one real expense on the
   * account — the money leaves the account once, not per purchase.
   */
  const payInvoice = async (card: FinanceCard, invoice: CardInvoice): Promise<void> => {
    const stamp = new Date().toISOString()
    const settled = invoice.transactions.map((t) => ({ ...t, paid: true, updatedAt: stamp }))
    const payment: Transaction = {
      id: uid(),
      type: 'expense',
      amount: invoice.total,
      description: `Fatura ${card.name} · ${monthLabel(invoice.month)}`,
      date: today(),
      method: 'debit',
      accountId: card.accountId,
      categoryId: 'cat-other',
      tags: ['fatura'],
      paid: true,
      createdAt: stamp,
      updatedAt: stamp
    }
    await saveFinance('transactions', [...settled, payment])
    pushToast({
      title: 'Fatura paga',
      description: `${card.name} · ${monthLabel(invoice.month)}`,
      variant: 'success'
    })
  }

  if (cards.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <CreditCard className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Nenhum cartão cadastrado</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Com limite, fechamento e vencimento cadastrados, o Finance HUB monta suas faturas
          sozinho e avisa antes de vencer.
        </p>
        <Button variant="primary" className="mt-6" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Adicionar cartão
        </Button>
        {creating && <CardDialog onClose={() => setCreating(false)} />}
      </div>
    )
  }

  return (
    <div className="space-y-5 px-8 pb-24">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {cards.length} cartão(ões)
        </h3>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Novo cartão
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ card, usage }, i) => (
          <motion.button
            key={card.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ y: -3 }}
            onClick={() => setSelectedId(card.id)}
            className={cn(
              'no-drag overflow-hidden rounded-2xl border text-left transition-colors',
              selected?.card.id === card.id ? 'border-primary/50' : 'border-border/70'
            )}
          >
            <div
              className="p-4"
              style={{
                background: `linear-gradient(135deg, hsl(${card.color} / 0.8), hsl(${card.color} / 0.28))`
              }}
            >
              <div className="flex items-start justify-between">
                <span className="text-xs text-white/75">{card.bank || 'Cartão'}</span>
                <span className="text-xs text-white/75">{CARD_BRAND_LABEL[card.brand]}</span>
              </div>
              <p className="mt-6 text-base font-semibold text-white">{card.name}</p>
              <p className="text-[11px] text-white/75">
                Fecha {card.closingDay} · vence {card.dueDay}
              </p>
            </div>

            <div className="space-y-2 bg-surface/70 p-4">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">Limite usado</span>
                <span className="tabular font-medium">{formatPercent(usage.ratio)}</span>
              </div>
              <ProgressBar
                value={usage.ratio}
                indicatorClassName={
                  usage.ratio >= 0.9
                    ? 'bg-destructive'
                    : usage.ratio >= 0.7
                      ? 'bg-[hsl(45_90%_58%)]'
                      : 'bg-success'
                }
              />
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">
                  <Money cents={usage.used} /> de <Money cents={card.limit} />
                </span>
                <span className="text-muted-foreground">
                  Livre <Money cents={usage.available} className="text-foreground" />
                </span>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {selected && (
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Faturas · {selected.card.name}</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setSpending(selected.card.id)}>
                <Plus className="h-3.5 w-3.5" /> Lançar compra
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(selected.card)}>
                Editar cartão
              </Button>
            </div>
          </div>

          {selected.usage.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma compra lançada neste cartão ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {selected.usage.invoices.slice(0, 6).map((invoice) => (
                <InvoiceBlock
                  key={invoice.month}
                  invoice={invoice}
                  onPay={() => void payInvoice(selected.card, invoice)}
                  onOpenTx={setEditingTx}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {creating && <CardDialog onClose={() => setCreating(false)} />}
      {editing && <CardDialog card={editing} onClose={() => setEditing(null)} />}
      {spending && (
        <TransactionDialog
          defaultType="expense"
          defaultCardId={spending}
          onClose={() => setSpending(null)}
        />
      )}
      {editingTx && <TransactionDialog transaction={editingTx} onClose={() => setEditingTx(null)} />}
    </div>
  )
}

function InvoiceBlock({
  invoice,
  onPay,
  onOpenTx
}: {
  invoice: CardInvoice
  onPay: () => void
  onOpenTx: (tx: Transaction) => void
}): JSX.Element {
  const [open, setOpen] = useState(invoice.open)

  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        invoice.paid
          ? 'border-border/50 bg-surface/30'
          : invoice.open
            ? 'border-primary/30 bg-primary/[0.04]'
            : 'border-border/70 bg-surface/50'
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setOpen((o) => !o)} className="no-drag flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {monthLabel(invoice.month)}
              {invoice.open && (
                <span className="ml-2 rounded-full bg-primary/15 px-1.5 py-px text-[10px] text-primary">
                  aberta
                </span>
              )}
              {invoice.paid && (
                <span className="ml-2 rounded-full bg-success/15 px-1.5 py-px text-[10px] text-success">
                  paga
                </span>
              )}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              Fecha {dayLabel(invoice.closeDate)} · vence {dayLabel(invoice.dueDate)} ·{' '}
              {invoice.transactions.length} compra(s)
            </span>
          </span>
        </button>
        <Money cents={invoice.total} className="shrink-0 text-sm font-semibold" />
        {!invoice.paid && invoice.total > 0 && (
          <Button size="sm" variant="secondary" onClick={onPay}>
            Pagar fatura
          </Button>
        )}
      </div>

      {open && invoice.transactions.length > 0 && (
        <div className="mt-3 border-t border-border/50 pt-2">
          <TransactionList transactions={invoice.transactions} onOpen={onOpenTx} />
        </div>
      )}
    </div>
  )
}
