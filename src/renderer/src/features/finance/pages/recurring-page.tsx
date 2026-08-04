import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Repeat } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { DynamicIcon } from '@/components/dynamic-icon'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import type { RecurringRule } from '@shared/finance'
import { FREQUENCY_LABEL } from '@shared/finance'
import { Money } from '../components/money'
import { RecurringDialog } from '../components/recurring-dialog'
import { useFinance } from '../hooks/use-finance'
import { monthlyCost, nextOccurrence } from '../services/recurrence-service'
import { dayLabel } from '@/lib/dates'

export function RecurringPage(): JSX.Element {
  const finance = useFinance()
  const saveFinance = useAppStore((s) => s.saveFinance)
  const [editing, setEditing] = useState<RecurringRule | null>(null)
  const [creating, setCreating] = useState<'income' | 'expense' | null>(null)

  const { expenses, incomes, monthlyOut, monthlyIn } = useMemo(() => {
    const rules = [...finance.recurring].sort((a, b) => a.dayOfMonth - b.dayOfMonth)
    const expense = rules.filter((r) => r.type === 'expense')
    const income = rules.filter((r) => r.type === 'income')
    return {
      expenses: expense,
      incomes: income,
      monthlyOut: expense.filter((r) => r.active).reduce((s, r) => s + monthlyCost(r), 0),
      monthlyIn: income.filter((r) => r.active).reduce((s, r) => s + monthlyCost(r), 0)
    }
  }, [finance.recurring])

  if (finance.recurring.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Repeat className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Contas e receitas fixas</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Cadastre Netflix, aluguel, internet, salário — o Finance HUB lança tudo automaticamente
          todo mês e avisa antes de vencer. Você só confirma o pagamento.
        </p>
        <div className="mt-6 flex gap-2">
          <Button variant="primary" onClick={() => setCreating('expense')}>
            <Plus className="h-4 w-4" /> Conta fixa
          </Button>
          <Button variant="secondary" onClick={() => setCreating('income')}>
            <Plus className="h-4 w-4" /> Receita fixa
          </Button>
        </div>
        {creating && (
          <RecurringDialog defaultType={creating} onClose={() => setCreating(null)} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5 px-8 pb-24">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-destructive/25 bg-destructive/[0.06] p-4">
          <p className="text-xs text-muted-foreground">Custo fixo mensal</p>
          <Money cents={monthlyOut} className="text-xl font-semibold" />
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            <Money cents={monthlyOut * 12} /> por ano
          </p>
        </Card>
        <Card className="border-success/25 bg-success/[0.06] p-4">
          <p className="text-xs text-muted-foreground">Receita fixa mensal</p>
          <Money cents={monthlyIn} className="text-xl font-semibold" />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Sobra prevista</p>
          <Money cents={monthlyIn - monthlyOut} colored className="text-xl font-semibold" />
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setCreating('income')}>
          <Plus className="h-4 w-4" /> Receita fixa
        </Button>
        <Button variant="primary" onClick={() => setCreating('expense')}>
          <Plus className="h-4 w-4" /> Conta fixa
        </Button>
      </div>

      <RuleGroup title="Contas fixas" rules={expenses} onEdit={setEditing} onToggle={saveFinance} />
      <RuleGroup title="Receitas fixas" rules={incomes} onEdit={setEditing} onToggle={saveFinance} />

      {creating && <RecurringDialog defaultType={creating} onClose={() => setCreating(null)} />}
      {editing && <RecurringDialog rule={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function RuleGroup({
  title,
  rules,
  onEdit,
  onToggle
}: {
  title: string
  rules: RecurringRule[]
  onEdit: (rule: RecurringRule) => void
  onToggle: (entity: 'recurring', rule: RecurringRule) => Promise<void>
}): JSX.Element | null {
  const finance = useFinance()
  if (rules.length === 0) return null

  return (
    <div>
      <h3 className="mb-2 px-1 text-xs font-semibold text-muted-foreground">{title}</h3>
      <div className="space-y-2">
        {rules.map((rule, i) => {
          const category = finance.categories.find((c) => c.id === rule.categoryId)
          const next = rule.active ? nextOccurrence(rule) : undefined
          return (
            <motion.div
              key={rule.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                'flex items-center gap-3 rounded-2xl border border-border/70 bg-surface/60 p-3.5 transition-colors hover:bg-surface-hover',
                !rule.active && 'opacity-55'
              )}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: `hsl(${category?.color ?? '250 82% 68%'} / 0.15)`,
                  color: `hsl(${category?.color ?? '250 82% 68%'})`
                }}
              >
                <DynamicIcon name={category?.icon ?? 'Repeat'} className="h-4 w-4" />
              </span>

              <button onClick={() => onEdit(rule)} className="no-drag min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium">{rule.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {FREQUENCY_LABEL[rule.frequency]}
                  {rule.frequency !== 'weekly' && ` · dia ${rule.dayOfMonth}`}
                  {next && ` · próximo em ${dayLabel(next)}`}
                  {rule.autoPay && ' · automático'}
                </p>
              </button>

              <Money
                cents={rule.amount}
                className={cn(
                  'shrink-0 text-sm font-semibold',
                  rule.type === 'income' ? 'text-success' : ''
                )}
              />
              <Switch
                checked={rule.active}
                onCheckedChange={(active) => void onToggle('recurring', { ...rule, active })}
              />
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
