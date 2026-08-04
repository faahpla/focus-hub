import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Plus, Target } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProgressBar } from '@/components/ui/progress-bar'
import { DynamicIcon } from '@/components/dynamic-icon'
import { useAppStore } from '@/stores/app-store'
import { useFinanceUi } from '@/stores/finance-ui-store'
import { useToastStore } from '@/stores/toast-store'
import { cn, mediaUrl, uid } from '@/lib/utils'
import type { FinanceGoal, Transaction } from '@shared/finance'
import { Money } from '../components/money'
import { GoalDialog } from '../components/goal-dialog'
import { useFinance } from '../hooks/use-finance'
import { monthTotals } from '../services/finance-engine'
import { formatPercent, parseMoney, percent } from '../utils/money'
import { currentMonth, dayLabel, diffDays, today } from '@/lib/dates'

export function GoalsPage(): JSX.Element {
  const finance = useFinance()
  const focusId = useFinanceUi((s) => s.focusId)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<FinanceGoal | null>(null)

  const goals = [...finance.goals]
    .filter((g) => !g.archived)
    .sort((a, b) => Number(a.currentAmount >= a.targetAmount) - Number(b.currentAmount >= b.targetAmount) || a.order - b.order)

  // How much has been left over lately — used to estimate a finish date.
  const monthlySaving = Math.max(0, monthTotals(finance.transactions, currentMonth()).net)

  if (goals.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Target className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Nenhuma meta ainda</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Notebook, viagem, reserva de emergência. Metas transformam o que sobra no fim do mês em
          algo concreto — com prazo e previsão de conclusão.
        </p>
        <Button variant="primary" className="mt-6" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Criar meta
        </Button>
        {creating && <GoalDialog onClose={() => setCreating(false)} />}
      </div>
    )
  }

  return (
    <div className="space-y-5 px-8 pb-24">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nova meta
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {goals.map((goal, i) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            index={i}
            monthlySaving={monthlySaving}
            highlight={goal.id === focusId}
            onEdit={() => setEditing(goal)}
          />
        ))}
      </div>

      {creating && <GoalDialog onClose={() => setCreating(false)} />}
      {editing && <GoalDialog goal={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function GoalCard({
  goal,
  index,
  monthlySaving,
  highlight,
  onEdit
}: {
  goal: FinanceGoal
  index: number
  monthlySaving: number
  highlight: boolean
  onEdit: () => void
}): JSX.Element {
  const saveFinance = useAppStore((s) => s.saveFinance)
  const pushToast = useToastStore((s) => s.push)
  const [depositing, setDepositing] = useState(false)
  const [amount, setAmount] = useState('')

  const ratio = percent(goal.currentAmount, goal.targetAmount)
  const done = goal.currentAmount >= goal.targetAmount
  const missing = Math.max(0, goal.targetAmount - goal.currentAmount)
  const monthsLeft = monthlySaving > 0 ? Math.ceil(missing / monthlySaving) : undefined
  const daysToDeadline = goal.deadline ? diffDays(today(), goal.deadline) : undefined

  /**
   * A deposit both raises the goal and records a real transfer out of the
   * account, so the money isn't counted twice — as available balance and as
   * progress towards the goal.
   */
  const deposit = async (): Promise<void> => {
    const cents = parseMoney(amount)
    if (cents <= 0) return
    const stamp = new Date().toISOString()
    await saveFinance('goals', {
      ...goal,
      currentAmount: goal.currentAmount + cents,
      updatedAt: stamp
    })
    if (goal.accountId) {
      const tx: Transaction = {
        id: uid(),
        type: 'expense',
        amount: cents,
        description: `Depósito · ${goal.name}`,
        date: today(),
        method: 'transfer',
        accountId: goal.accountId,
        categoryId: 'cat-investments',
        goalId: goal.id,
        tags: ['meta'],
        paid: true,
        createdAt: stamp,
        updatedAt: stamp
      }
      await saveFinance('transactions', tx)
    }
    pushToast({
      title: `+${(cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em ${goal.name}`,
      variant: 'success'
    })
    setAmount('')
    setDepositing(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card
        className={cn(
          'overflow-hidden transition-colors',
          done && 'border-success/35 bg-success/[0.05]',
          highlight && 'border-primary/50'
        )}
      >
        {goal.image && (
          <div className="h-24 w-full overflow-hidden bg-surface-elevated">
            <img
              src={mediaUrl(goal.image)}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                // A moved or deleted image should not leave a broken icon.
                e.currentTarget.parentElement?.remove()
              }}
            />
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `hsl(${goal.color} / 0.15)`, color: `hsl(${goal.color})` }}
            >
              <DynamicIcon name={goal.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{goal.name}</p>
              <p className="text-xs text-muted-foreground">
                {done ? (
                  <span className="text-success">Concluída 🎉</span>
                ) : (
                  <>Faltam <Money cents={missing} /></>
                )}
              </p>
            </div>
            <Button size="sm" variant="ghost" className="px-2 text-xs" onClick={onEdit}>
              Editar
            </Button>
          </div>

          <div className="mt-3">
            <div className="mb-1.5 flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">
                <Money cents={goal.currentAmount} /> de <Money cents={goal.targetAmount} />
              </span>
              <span className="tabular font-medium">{formatPercent(ratio)}</span>
            </div>
            <ProgressBar
              value={ratio}
              indicatorClassName={done ? 'bg-success' : undefined}
            />
          </div>

          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {goal.deadline && (
              <span className={cn(daysToDeadline !== undefined && daysToDeadline < 0 && !done && 'text-destructive')}>
                Prazo {dayLabel(goal.deadline)}
              </span>
            )}
            {!done && monthsLeft !== undefined && monthsLeft <= 120 && (
              <span>≈ {monthsLeft} {monthsLeft === 1 ? 'mês' : 'meses'} nesse ritmo</span>
            )}
          </div>

          {!done && (
            <div className="mt-3">
              {depositing ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={amount}
                    placeholder="0,00"
                    inputMode="decimal"
                    onChange={(e) => setAmount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void deposit()
                      if (e.key === 'Escape') setDepositing(false)
                    }}
                    className="h-9 tabular"
                  />
                  <Button size="sm" variant="primary" onClick={() => void deposit()}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  onClick={() => setDepositing(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Guardar dinheiro
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  )
}
