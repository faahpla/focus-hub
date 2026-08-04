import { ProgressBar } from '@/components/ui/progress-bar'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { Money } from './money'
import { projectSpend } from '../services/finance-engine'
import { formatPercent, percent } from '../utils/money'

/**
 * How much of a project's budget has been spent. Shown inside the project
 * editor so the number lives next to the work it pays for.
 */
export function ProjectBudgetBar({
  projectId,
  budget
}: {
  projectId: string
  budget: number
}): JSX.Element {
  const transactions = useAppStore((s) => s.finance.transactions)
  const spent = projectSpend(transactions, projectId)
  const ratio = budget > 0 ? spent / budget : 0
  const over = spent > budget

  return (
    <div className="rounded-xl border border-border/60 bg-surface/40 p-3">
      <div className="mb-2 flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">
          <Money cents={spent} /> de <Money cents={budget} />
        </span>
        <span
          className={cn(
            'tabular font-medium',
            over ? 'text-destructive' : ratio >= 0.75 ? 'text-[hsl(45_90%_58%)]' : 'text-success'
          )}
        >
          {formatPercent(ratio)}
        </span>
      </div>
      <ProgressBar
        value={percent(spent, budget)}
        indicatorClassName={
          over ? 'bg-destructive' : ratio >= 0.75 ? 'bg-[hsl(45_90%_58%)]' : 'bg-success'
        }
      />
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {over ? (
          <>
            <Money cents={spent - budget} className="text-destructive" /> acima do orçamento
          </>
        ) : (
          <>
            Restam <Money cents={budget - spent} className="text-foreground" />
          </>
        )}
      </p>
    </div>
  )
}
