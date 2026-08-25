import { useEffect, useRef, useState } from 'react'
import { Clock, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './dropdown-menu'
import { cn } from '@/lib/utils'

/**
 * Parse whatever the user actually types into HH:mm.
 *
 * A native `input[type=time]` fights the keyboard: it owns each segment, so
 * typing "12:30" straight through lands wrong as often as right. This takes a
 * plain string and accepts every shape a person uses for a time — "1230",
 * "12:30", "12h30", "12.30", "9", "9h" — and returns null when it isn't one.
 */
export function parseTime(raw: string): string | null {
  const s = raw.trim().toLowerCase()
  if (!s) return null

  const digits = s.replace(/\D/g, '')
  let h: number
  let m = 0

  if (/^\d{1,2}$/.test(digits) && !/[:h.]/.test(s)) {
    h = Number(digits)
  } else if (digits.length === 3) {
    h = Number(digits.slice(0, 1))
    m = Number(digits.slice(1))
  } else if (digits.length === 4) {
    h = Number(digits.slice(0, 2))
    m = Number(digits.slice(2))
  } else if (/[:h.]/.test(s)) {
    const [hp, mp = '0'] = s.split(/[:h.]/)
    h = Number(hp)
    m = Number(mp || 0)
  } else {
    return null
  }

  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h > 23 || m > 59 || h < 0 || m < 0) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Half-hour steps across a working day — the list behind the clock button. */
function presetTimes(): string[] {
  const out: string[] = []
  for (let minute = 6 * 60; minute <= 23 * 60 + 30; minute += 30) {
    out.push(
      `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
    )
  }
  return out
}

function nowRounded(): string {
  const d = new Date()
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function TimeField({
  value,
  onChange,
  disabled,
  className,
  placeholder = '--:--'
}: {
  value?: string
  onChange: (next: string | undefined) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}): JSX.Element {
  const [draft, setDraft] = useState(value ?? '')
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Follow the stored value unless the user is mid-edit.
  useEffect(() => {
    setDraft(value ?? '')
  }, [value])

  const commit = (): void => {
    if (!draft.trim()) {
      if (value) onChange(undefined)
      return
    }
    const parsed = parseTime(draft)
    if (parsed) {
      setDraft(parsed)
      if (parsed !== value) onChange(parsed)
    } else {
      // Unparseable: fall back to what was stored rather than keeping junk.
      setDraft(value ?? '')
    }
  }

  // Open the list already scrolled to where the user is.
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      listRef.current?.querySelector('[data-current="true"]')?.scrollIntoView({ block: 'center' })
    }, 10)
    return () => clearTimeout(t)
  }, [open])

  const times = presetTimes()
  const nearest = value ? times.find((t) => t >= value) ?? times[times.length - 1] : '09:00'

  return (
    <div
      className={cn(
        'no-drag flex h-9 items-center rounded-xl border border-input bg-surface/60 transition-colors focus-within:border-primary/60',
        disabled && 'pointer-events-none opacity-40',
        className
      )}
    >
      <input
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
            e.currentTarget.blur()
          }
          if (e.key === 'Escape') setDraft(value ?? '')
        }}
        placeholder={placeholder}
        inputMode="numeric"
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm tabular placeholder:text-muted-foreground/50 focus:outline-none"
      />
      {value && !disabled && (
        <button
          onClick={() => onChange(undefined)}
          title="Limpar horário"
          className="flex h-full w-7 items-center justify-center text-muted-foreground/60 transition-colors hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            disabled={disabled}
            title="Escolher horário"
            className="flex h-full w-9 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <Clock className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36 p-1">
          <DropdownMenuItem onSelect={() => onChange(nowRounded())}>
            <span className="tabular">Agora · {nowRounded()}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div ref={listRef} className="max-h-56 overflow-y-auto scrollbar-thin">
            {times.map((t) => (
              <DropdownMenuItem
                key={t}
                active={t === value}
                data-current={t === (value ?? nearest) ? 'true' : undefined}
                onSelect={() => onChange(t)}
              >
                <span className="tabular">{t}</span>
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
