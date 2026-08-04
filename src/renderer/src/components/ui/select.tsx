import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface SelectOption<T extends string> {
  value: T
  label: string
  /** Small leading element — an icon or a colour dot. */
  adornment?: React.ReactNode
  hint?: string
}

interface SelectProps<T extends string> {
  value?: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  label?: string
  /** Adds a "nenhum" entry that clears the value. */
  clearable?: boolean
  clearLabel?: string
  onClear?: () => void
  className?: string
  disabled?: boolean
  align?: 'start' | 'end'
}

/**
 * A select that looks like the rest of the app.
 *
 * The native <select> renders an OS-drawn popup that ignores the theme, which
 * stands out badly in a dark window — this is the same dropdown the rest of
 * Focus HUB uses, wrapped in a form-field shape.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder = 'Selecionar',
  label,
  clearable,
  clearLabel = 'Nenhum',
  onClear,
  className,
  disabled,
  align = 'start'
}: SelectProps<T>): JSX.Element {
  const selected = options.find((o) => o.value === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'no-drag flex h-10 w-full items-center gap-2 rounded-xl border border-input bg-surface/60 px-3.5 text-sm transition-colors hover:bg-surface-hover focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-50',
            className
          )}
        >
          {selected?.adornment}
          <span
            className={cn('min-w-0 flex-1 truncate text-left', !selected && 'text-muted-foreground/70')}
          >
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="max-h-[19rem] overflow-y-auto">
        {label && <DropdownMenuLabel>{label}</DropdownMenuLabel>}
        {clearable && (
          <>
            <DropdownMenuItem active={!value} onSelect={() => onClear?.()}>
              <span className="text-muted-foreground">{clearLabel}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            active={option.value === value}
            onSelect={() => onChange(option.value)}
          >
            <span className="flex items-center gap-2">
              {option.adornment}
              <span className="truncate">{option.label}</span>
              {option.hint && (
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{option.hint}</span>
              )}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
