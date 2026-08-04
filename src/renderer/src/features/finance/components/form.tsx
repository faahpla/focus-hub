import { forwardRef, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { DynamicIcon } from '@/components/dynamic-icon'
import { cn } from '@/lib/utils'
import { centsToInput, parseMoney } from '../utils/money'

/** Label + control + optional hint, so every form in the module lines up. */
export function Field({
  label,
  hint,
  className,
  children
}: {
  label: string
  hint?: string
  className?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground/80">{hint}</span>}
    </label>
  )
}

/**
 * Amount field. Keeps the raw string while the user types — reformatting on
 * every keystroke fights the caret — and commits cents on change.
 */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  {
    value: number
    onChange: (cents: number) => void
    placeholder?: string
    className?: string
    autoFocus?: boolean
  }
>(({ value, onChange, placeholder = '0,00', className, autoFocus }, ref) => {
  const [text, setText] = useState(() => centsToInput(value))

  // Follow external changes (editing a different row, a template being applied)
  // without stomping on what is being typed right now.
  useEffect(() => {
    if (parseMoney(text) !== value) setText(centsToInput(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input
        ref={ref}
        inputMode="decimal"
        autoFocus={autoFocus}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value)
          onChange(parseMoney(e.target.value))
        }}
        onBlur={() => setText(centsToInput(parseMoney(text)))}
        className={cn('pl-10 tabular', className)}
      />
    </div>
  )
})
MoneyInput.displayName = 'MoneyInput'

/** Free-form tags: type, press Enter or comma, click × to remove. */
export function TagsInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = 'Adicionar tag…'
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
}): JSX.Element {
  const [draft, setDraft] = useState('')

  const add = (raw: string): void => {
    const tag = raw.trim().toLowerCase()
    if (!tag || tags.includes(tag)) {
      setDraft('')
      return
    }
    onChange([...tags, tag])
    setDraft('')
  }

  const available = suggestions.filter((s) => !tags.includes(s)).slice(0, 6)

  return (
    <div>
      <div className="flex min-h-[2.5rem] flex-wrap items-center gap-1.5 rounded-xl border border-input bg-surface/60 px-2 py-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="no-drag opacity-70 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          placeholder={tags.length === 0 ? placeholder : ''}
          onChange={(e) => {
            // A comma ends the tag, matching how people type lists.
            if (e.target.value.includes(',')) add(e.target.value.replace(',', ''))
            else setDraft(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(draft)
            } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
              onChange(tags.slice(0, -1))
            }
          }}
          onBlur={() => add(draft)}
          className="no-drag min-w-[6rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </div>
      {available.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {available.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => add(tag)}
              className="no-drag rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ColorPicker({
  value,
  colors,
  onChange
}: {
  value: string
  colors: string[]
  onChange: (color: string) => void
}): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          style={{ background: `hsl(${color})` }}
          className={cn(
            'no-drag h-7 w-7 rounded-lg transition-transform',
            value === color
              ? 'ring-2 ring-foreground ring-offset-2 ring-offset-surface-elevated'
              : 'hover:scale-110'
          )}
        />
      ))}
    </div>
  )
}

export function IconPicker({
  value,
  icons,
  color,
  onChange
}: {
  value: string
  icons: string[]
  color?: string
  onChange: (icon: string) => void
}): JSX.Element {
  return (
    <div className="grid max-h-[9rem] grid-cols-8 gap-1.5 overflow-y-auto scrollbar-thin pr-1">
      {icons.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onChange(icon)}
          className={cn(
            'no-drag flex h-9 items-center justify-center rounded-lg border transition-colors',
            value === icon
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border/60 text-muted-foreground hover:bg-surface-hover hover:text-foreground'
          )}
          style={value === icon && color ? { color: `hsl(${color})` } : undefined}
        >
          <DynamicIcon name={icon} className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}

/** Segmented control — the type switch on the transaction form, and filters. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className
}: {
  value: T
  options: { value: T; label: string; icon?: React.ReactNode; activeClass?: string }[]
  onChange: (value: T) => void
  className?: string
}): JSX.Element {
  return (
    <div className={cn('flex gap-1 rounded-xl border border-border/70 bg-surface/50 p-1', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'no-drag flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
            value === option.value
              ? option.activeClass ?? 'bg-surface-elevated text-foreground shadow-soft'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}
