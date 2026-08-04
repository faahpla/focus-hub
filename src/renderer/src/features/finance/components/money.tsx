import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { formatMoney, formatMoneyCompact } from '../utils/money'

interface MoneyProps {
  cents: number
  /** Colour by sign: green for positive, red for negative. */
  colored?: boolean
  /** Show a leading + on positive values. */
  sign?: boolean
  compact?: boolean
  className?: string
}

/**
 * Every amount on screen goes through this so "ocultar valores" is a single
 * switch instead of a flag threaded through forty components. Values are
 * blurred rather than replaced, so the layout never shifts when it is toggled.
 */
export function Money({ cents, colored, sign, compact, className }: MoneyProps): JSX.Element {
  const hidden = useAppStore((s) => s.finance.settings.hideValues)
  const text = compact ? formatMoneyCompact(cents) : formatMoney(cents, { sign })

  return (
    <span
      className={cn(
        'tabular',
        colored && (cents > 0 ? 'text-success' : cents < 0 ? 'text-destructive' : ''),
        hidden && 'select-none blur-[7px]',
        className
      )}
      aria-label={hidden ? 'valor oculto' : text}
    >
      {text}
    </span>
  )
}
