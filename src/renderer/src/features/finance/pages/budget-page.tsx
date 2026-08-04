import { useEffect, useMemo, useState } from 'react'
import { Gauge, PiggyBank, Plus, TrendingUp, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { DynamicIcon } from '@/components/dynamic-icon'
import { useAppStore } from '@/stores/app-store'
import { useFinanceUi } from '@/stores/finance-ui-store'
import { cn } from '@/lib/utils'
import type { BudgetPlan } from '@shared/finance'
import { Money } from '../components/money'
import { Field, MoneyInput } from '../components/form'
import { CategorySelect } from '../components/pickers'
import { useFinance } from '../hooks/use-finance'
import { monthTotals, transactionsInMonth } from '../services/finance-engine'
import { formatPercent, percent } from '../utils/money'
import { addMonthsToKey, monthLabel } from '../utils/dates'

function emptyPlan(month: string): BudgetPlan {
  return {
    month,
    plannedIncome: 0,
    spendLimit: 0,
    saveTarget: 0,
    investTarget: 0,
    categories: []
  }
}

/** Green under 75%, amber up to 100%, red past it. */
function toneFor(ratio: number): { bar: string; text: string } {
  if (ratio >= 1) return { bar: 'bg-destructive', text: 'text-destructive' }
  if (ratio >= 0.75) return { bar: 'bg-[hsl(45_90%_58%)]', text: 'text-[hsl(45_90%_58%)]' }
  return { bar: 'bg-success', text: 'text-success' }
}

export function BudgetPage(): JSX.Element {
  const finance = useFinance()
  const saveBudget = useAppStore((s) => s.saveBudget)
  const month = useFinanceUi((s) => s.month)

  const stored = finance.budgets.find((b) => b.month === month)
  const [draft, setDraft] = useState<BudgetPlan>(() => stored ?? emptyPlan(month))
  const [addingCategory, setAddingCategory] = useState(false)

  // Switching months (or loading a saved plan) reseeds the form.
  useEffect(() => {
    setDraft(finance.budgets.find((b) => b.month === month) ?? emptyPlan(month))
  }, [month, finance.budgets])

  const totals = useMemo(() => monthTotals(finance.transactions, month), [finance.transactions, month])
  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const tx of transactionsInMonth(finance.transactions, month)) {
      if (tx.type !== 'expense' || !tx.paid) continue
      const id = tx.categoryId ?? 'cat-other'
      map.set(id, (map.get(id) ?? 0) + tx.amount)
    }
    return map
  }, [finance.transactions, month])

  const patch = (values: Partial<BudgetPlan>): void => setDraft((d) => ({ ...d, ...values }))
  const persist = (next: BudgetPlan): void => {
    setDraft(next)
    void saveBudget(next)
  }

  const previous = finance.budgets.find((b) => b.month === addMonthsToKey(month, -1))
  const spendRatio = draft.spendLimit > 0 ? totals.expense / draft.spendLimit : 0
  const tone = toneFor(spendRatio)

  return (
    <div className="space-y-5 px-8 pb-24">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Planejamento de {monthLabel(month, true)}</h3>
            <p className="text-xs text-muted-foreground">
              Defina os tetos e acompanhe as barras mudando de cor conforme o mês anda.
            </p>
          </div>
          <div className="flex gap-2">
            {previous && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => persist({ ...previous, month })}
                title="Repetir o planejamento do mês passado"
              >
                Copiar mês anterior
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={() => persist(draft)}>
              Salvar plano
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Receita prevista">
            <MoneyInput
              value={draft.plannedIncome}
              onChange={(plannedIncome) => patch({ plannedIncome })}
            />
          </Field>
          <Field label="Teto de gastos">
            <MoneyInput value={draft.spendLimit} onChange={(spendLimit) => patch({ spendLimit })} />
          </Field>
          <Field label="Quero economizar">
            <MoneyInput value={draft.saveTarget} onChange={(saveTarget) => patch({ saveTarget })} />
          </Field>
          <Field label="Quero investir">
            <MoneyInput
              value={draft.investTarget}
              onChange={(investTarget) => patch({ investTarget })}
            />
          </Field>
        </div>
      </Card>

      {/* Headline progress */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PlanCard
          icon={<Wallet className="h-4 w-4" />}
          label="Receita"
          current={totals.income}
          target={draft.plannedIncome}
          inverse
        />
        <PlanCard
          icon={<Gauge className="h-4 w-4" />}
          label="Gastos"
          current={totals.expense}
          target={draft.spendLimit}
        />
        <PlanCard
          icon={<PiggyBank className="h-4 w-4" />}
          label="Economia"
          current={Math.max(0, totals.net)}
          target={draft.saveTarget}
          inverse
        />
        <PlanCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Investido"
          current={spentByCategory.get('cat-investments') ?? 0}
          target={draft.investTarget}
          inverse
        />
      </div>

      {draft.spendLimit > 0 && (
        <Card className="p-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Teto total do mês</h3>
            <span className={cn('text-xs tabular font-medium', tone.text)}>
              {formatPercent(spendRatio)} usado
            </span>
          </div>
          <ProgressBar value={Math.min(1, spendRatio)} indicatorClassName={tone.bar} />
          <p className="mt-2 text-xs text-muted-foreground">
            <Money cents={totals.expense} /> de <Money cents={draft.spendLimit} /> ·{' '}
            {totals.expense <= draft.spendLimit ? (
              <>
                restam <Money cents={draft.spendLimit - totals.expense} className="text-foreground" />
              </>
            ) : (
              <span className="text-destructive">
                <Money cents={totals.expense - draft.spendLimit} /> acima do planejado
              </span>
            )}
          </p>
        </Card>
      )}

      {/* Per-category limits */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Limite por categoria</h3>
          <Button size="sm" variant="secondary" onClick={() => setAddingCategory(true)}>
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>

        {addingCategory && (
          <div className="mb-4 flex items-end gap-2">
            <div className="flex-1">
              <CategorySelect
                scope="expense"
                clearable={false}
                onChange={(categoryId) => {
                  if (!categoryId || draft.categories.some((c) => c.categoryId === categoryId)) {
                    setAddingCategory(false)
                    return
                  }
                  persist({
                    ...draft,
                    categories: [...draft.categories, { categoryId, limit: 0 }]
                  })
                  setAddingCategory(false)
                }}
              />
            </div>
            <Button size="sm" variant="ghost" onClick={() => setAddingCategory(false)}>
              Cancelar
            </Button>
          </div>
        )}

        {draft.categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem limites por categoria. Adicione as que costumam sair do controle — normalmente
            alimentação e lazer.
          </p>
        ) : (
          <div className="space-y-3">
            {draft.categories.map((entry) => {
              const category = finance.categories.find((c) => c.id === entry.categoryId)
              const spent = spentByCategory.get(entry.categoryId) ?? 0
              const ratio = entry.limit > 0 ? spent / entry.limit : 0
              const rowTone = toneFor(ratio)
              return (
                <div key={entry.categoryId} className="rounded-xl border border-border/60 p-3">
                  <div className="mb-2 flex items-center gap-2.5">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: `hsl(${category?.color ?? '240 8% 60%'} / 0.16)`,
                        color: `hsl(${category?.color ?? '240 8% 60%'})`
                      }}
                    >
                      <DynamicIcon name={category?.icon ?? 'Shapes'} className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {category?.name ?? 'Categoria removida'}
                    </span>
                    <div className="w-32">
                      <MoneyInput
                        value={entry.limit}
                        onChange={(limit) =>
                          setDraft((d) => ({
                            ...d,
                            categories: d.categories.map((c) =>
                              c.categoryId === entry.categoryId ? { ...c, limit } : c
                            )
                          }))
                        }
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2 text-xs text-muted-foreground"
                      onClick={() =>
                        persist({
                          ...draft,
                          categories: draft.categories.filter(
                            (c) => c.categoryId !== entry.categoryId
                          )
                        })
                      }
                    >
                      Remover
                    </Button>
                  </div>
                  <ProgressBar value={Math.min(1, ratio)} indicatorClassName={rowTone.bar} />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    <Money cents={spent} /> de <Money cents={entry.limit} />
                    {entry.limit > 0 && (
                      <span className={cn('ml-1.5', rowTone.text)}>{formatPercent(ratio)}</span>
                    )}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

function PlanCard({
  icon,
  label,
  current,
  target,
  inverse
}: {
  icon: React.ReactNode
  label: string
  current: number
  target: number
  /** True when going *over* the number is a good thing (income, savings). */
  inverse?: boolean
}): JSX.Element {
  const ratio = percent(current, target)
  const raw = target > 0 ? current / target : 0
  const tone = inverse
    ? raw >= 1
      ? { bar: 'bg-success', text: 'text-success' }
      : { bar: 'bg-primary', text: 'text-muted-foreground' }
    : toneFor(raw)

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <Money cents={current} className="block text-lg font-semibold" />
      {target > 0 ? (
        <>
          <p className="mb-2 text-[11px] text-muted-foreground">
            meta <Money cents={target} />
          </p>
          <ProgressBar value={ratio} indicatorClassName={tone.bar} />
          <p className={cn('mt-1 text-[11px] tabular', tone.text)}>{formatPercent(raw)}</p>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">sem meta definida</p>
      )}
    </Card>
  )
}
