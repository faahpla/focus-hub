import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const pad = (n: number): string => String(n).padStart(2, '0')

/** 'YYYY-MM-DD' — built from local parts so no timezone shifting happens. */
const toISODate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Parse 'YYYY-MM-DD' as a *local* date (new Date(str) would treat it as UTC). */
function fromISODate(value?: string): Date | undefined {
  if (!value) return undefined
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/**
 * Calendar that matches the app instead of the OS. Expands inline rather than
 * floating, so it can't be clipped by the scrolling panels it lives in.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Sem prazo'
}: {
  value?: string
  onChange: (next?: string) => void
  placeholder?: string
}): JSX.Element {
  const selected = fromISODate(value)
  const today = new Date()

  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => {
    const base = selected ?? today
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  // Six weeks starting on the Sunday on or before the 1st — stable grid height.
  const days = useMemo(() => {
    const start = new Date(cursor)
    start.setDate(1 - start.getDay())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [cursor])

  const shiftMonth = (delta: number): void =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1))

  const monthLabel = cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const pick = (d: Date): void => {
    onChange(toISODate(d))
    setOpen(false)
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'no-drag flex h-9 w-full items-center justify-between gap-2 rounded-xl border px-3 text-xs transition-colors',
          open
            ? 'border-primary/60 bg-surface/80'
            : 'border-input bg-surface/60 hover:bg-surface-hover'
        )}
      >
        <span className={cn(!selected && 'text-muted-foreground')}>
          {selected
            ? selected.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })
            : placeholder}
        </span>
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl border border-border/70 bg-surface-elevated p-3 shadow-elevated">
              {/* Month nav */}
              <div className="mb-2 flex items-center justify-between">
                <button
                  onClick={() => shiftMonth(-1)}
                  className="no-drag flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {/* first-letter, not `capitalize` — that would give "Julho De 2026". */}
                <span className="text-xs font-medium first-letter:uppercase">{monthLabel}</span>
                <button
                  onClick={() => shiftMonth(1)}
                  className="no-drag flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Weekday header */}
              <div className="mb-1 grid grid-cols-7 gap-0.5">
                {WEEKDAYS.map((w, i) => (
                  <span
                    key={i}
                    className="flex h-6 items-center justify-center text-[10px] font-medium text-muted-foreground/70"
                  >
                    {w}
                  </span>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-0.5">
                {days.map((d) => {
                  const isCurrentMonth = d.getMonth() === cursor.getMonth()
                  const isSelected = selected ? sameDay(d, selected) : false
                  const isToday = sameDay(d, today)
                  return (
                    <button
                      key={d.getTime()}
                      onClick={() => pick(d)}
                      className={cn(
                        'no-drag flex h-7 items-center justify-center rounded-lg text-[11px] tabular transition-colors',
                        isSelected
                          ? 'bg-primary font-semibold text-primary-foreground'
                          : isCurrentMonth
                            ? 'text-foreground hover:bg-surface-hover'
                            : 'text-muted-foreground/35 hover:bg-surface-hover',
                        !isSelected && isToday && 'ring-1 ring-inset ring-primary/60'
                      )}
                    >
                      {d.getDate()}
                    </button>
                  )
                })}
              </div>

              {/* Actions */}
              <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
                <button
                  onClick={() => {
                    onChange(undefined)
                    setOpen(false)
                  }}
                  className="no-drag rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-destructive"
                >
                  Limpar
                </button>
                <button
                  onClick={() => {
                    setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
                    pick(today)
                  }}
                  className="no-drag rounded-md px-1.5 py-1 text-[11px] text-primary transition-colors hover:brightness-125"
                >
                  Hoje
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
