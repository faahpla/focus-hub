import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeftRight, Landmark, Plus, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DynamicIcon } from '@/components/dynamic-icon'
import { cn } from '@/lib/utils'
import type { FinanceAccount, Transaction } from '@shared/finance'
import { ACCOUNT_KIND_LABEL } from '@shared/finance'
import { Money } from '../components/money'
import { AccountDialog } from '../components/account-dialog'
import { TransactionDialog } from '../components/transaction-dialog'
import { TransactionList } from '../components/transaction-list'
import { useFinance } from '../hooks/use-finance'
import { accountBalance, totalBalance } from '../services/finance-engine'

export function AccountsPage(): JSX.Element {
  const finance = useFinance()
  const [editing, setEditing] = useState<FinanceAccount | null>(null)
  const [creating, setCreating] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const accounts = useMemo(
    () =>
      finance.accounts
        .filter((a) => !a.archived)
        .map((account) => ({
          account,
          balance: accountBalance(account, finance.transactions)
        }))
        .sort((a, b) => a.account.order - b.account.order),
    [finance]
  )

  const selected = accounts.find((a) => a.account.id === selectedId)
  const history = useMemo(() => {
    if (!selectedId) return []
    return finance.transactions
      .filter((t) => t.accountId === selectedId || t.toAccountId === selectedId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 40)
  }, [finance.transactions, selectedId])

  if (accounts.length === 0) {
    return (
      <EmptyState onCreate={() => setCreating(true)}>
        {creating && <AccountDialog onClose={() => setCreating(false)} />}
      </EmptyState>
    )
  }

  return (
    <div className="space-y-5 px-8 pb-24">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">Saldo somado</p>
          <Money cents={totalBalance(finance)} className="text-3xl font-semibold tracking-tight" />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setTransferring(true)}>
            <ArrowLeftRight className="h-4 w-4" /> Transferir
          </Button>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nova conta
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {/* Each card is a div, not a button: it contains the "Editar" button,
            and nesting buttons is invalid HTML that breaks keyboard nav. */}
        {accounts.map(({ account, balance }, i) => (
          <motion.div
            key={account.id}
            role="button"
            tabIndex={0}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            whileHover={{ y: -2 }}
            onClick={() => setSelectedId(selectedId === account.id ? null : account.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setSelectedId(selectedId === account.id ? null : account.id)
              }
            }}
            className={cn(
              'no-drag cursor-pointer rounded-2xl border bg-surface/60 p-4 text-left transition-colors',
              selectedId === account.id
                ? 'border-primary/50 bg-primary/5'
                : 'border-border/70 hover:bg-surface-hover'
            )}
          >
            <div className="flex items-start justify-between">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: `hsl(${account.color} / 0.15)`,
                  color: `hsl(${account.color})`
                }}
              >
                <DynamicIcon name={account.icon} className="h-5 w-5" />
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditing(account)
                }}
              >
                Editar
              </Button>
            </div>
            <p className="mt-3 truncate text-sm font-medium">{account.name}</p>
            <p className="text-xs text-muted-foreground">{ACCOUNT_KIND_LABEL[account.kind]}</p>
            <Money
              cents={balance}
              colored={balance < 0}
              className="mt-2 block text-xl font-semibold"
            />
          </motion.div>
        ))}
      </div>

      {selected && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Extrato · {selected.account.name}</h3>
            <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
              Fechar
            </Button>
          </div>
          <TransactionList
            transactions={history}
            onOpen={setEditingTx}
            empty="Nenhuma movimentação nesta conta ainda."
          />
        </Card>
      )}

      {creating && <AccountDialog onClose={() => setCreating(false)} />}
      {editing && <AccountDialog account={editing} onClose={() => setEditing(null)} />}
      {transferring && (
        <TransactionDialog defaultType="transfer" onClose={() => setTransferring(false)} />
      )}
      {editingTx && <TransactionDialog transaction={editingTx} onClose={() => setEditingTx(null)} />}
    </div>
  )
}

function EmptyState({
  onCreate,
  children
}: {
  onCreate: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Landmark className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">Comece pelas suas contas</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Cadastre onde seu dinheiro fica — carteira, banco, conta PJ — com o saldo de hoje. Todo o
        resto do Finance HUB parte daí.
      </p>
      <Button variant="primary" className="mt-6" onClick={onCreate}>
        <Wallet className="h-4 w-4" /> Criar primeira conta
      </Button>
      {children}
    </div>
  )
}
