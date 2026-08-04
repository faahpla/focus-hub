import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Delete, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { useFinanceUi } from '@/stores/finance-ui-store'
import { cn } from '@/lib/utils'

const LENGTH = 4

/** SHA-256 of the PIN. The PIN itself is never written to disk. */
export async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`focus-hub:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * A local lock for the Finance HUB.
 *
 * To be clear about what this is: it keeps someone glancing at the screen from
 * reading your finances. It is not encryption — the data file on disk stays
 * readable to anything running as your Windows user, so it protects against a
 * shoulder, not against a thief with the machine.
 */
export function PinLock({ onUnlock }: { onUnlock: () => void }): JSX.Element {
  const pinHash = useAppStore((s) => s.finance.settings.pinHash)
  const [digits, setDigits] = useState('')
  const [error, setError] = useState(false)
  const checking = useRef(false)

  useEffect(() => {
    if (digits.length !== LENGTH || checking.current) return
    checking.current = true
    void (async () => {
      const hash = await hashPin(digits)
      if (hash === pinHash) {
        onUnlock()
      } else {
        setError(true)
        setTimeout(() => {
          setDigits('')
          setError(false)
          checking.current = false
        }, 600)
        return
      }
      checking.current = false
    })()
  }, [digits, pinHash, onUnlock])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (/^\d$/.test(e.key)) setDigits((d) => (d.length < LENGTH ? d + e.key : d))
      else if (e.key === 'Backspace') setDigits((d) => d.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full flex-col items-center justify-center px-8">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Lock className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">Finance HUB bloqueado</h2>
      <p className="mt-1 text-sm text-muted-foreground">Digite seu PIN para continuar.</p>

      <motion.div
        animate={error ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className="my-7 flex gap-3"
      >
        {Array.from({ length: LENGTH }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-3.5 w-3.5 rounded-full border transition-colors',
              error
                ? 'border-destructive bg-destructive'
                : i < digits.length
                  ? 'border-primary bg-primary'
                  : 'border-border bg-transparent'
            )}
          />
        ))}
      </motion.div>

      <div className="grid w-[13.5rem] grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <KeyButton key={n} onClick={() => setDigits((d) => (d.length < LENGTH ? d + n : d))}>
            {n}
          </KeyButton>
        ))}
        <span />
        <KeyButton onClick={() => setDigits((d) => (d.length < LENGTH ? d + '0' : d))}>0</KeyButton>
        <KeyButton onClick={() => setDigits((d) => d.slice(0, -1))}>
          <Delete className="h-4 w-4" />
        </KeyButton>
      </div>
    </div>
  )
}

function KeyButton({
  children,
  onClick
}: {
  children: React.ReactNode
  onClick: () => void
}): JSX.Element {
  return (
    <Button variant="secondary" className="h-12 text-base" onClick={onClick}>
      {children}
    </Button>
  )
}

/** Set, change or remove the PIN — lives in the module's settings sheet. */
export function PinSettings(): JSX.Element {
  const settings = useAppStore((s) => s.finance.settings)
  const saveFinanceSettings = useAppStore((s) => s.saveFinanceSettings)
  const lock = useFinanceUi((s) => s.lock)
  const [entering, setEntering] = useState(false)
  const [pin, setPin] = useState('')

  const apply = async (): Promise<void> => {
    if (pin.length !== LENGTH) return
    await saveFinanceSettings({ pinHash: await hashPin(pin), lockOnOpen: true })
    setPin('')
    setEntering(false)
  }

  if (!settings.pinHash) {
    return entering ? (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={pin}
          inputMode="numeric"
          maxLength={LENGTH}
          placeholder="4 dígitos"
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          className="no-drag h-9 w-28 rounded-lg border border-input bg-surface/60 px-3 text-center text-sm tabular tracking-[0.4em] outline-none"
        />
        <Button size="sm" variant="primary" disabled={pin.length !== LENGTH} onClick={() => void apply()}>
          Definir
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEntering(false)}>
          Cancelar
        </Button>
      </div>
    ) : (
      <Button size="sm" variant="secondary" onClick={() => setEntering(true)}>
        Criar PIN
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={() => lock()}>
        Bloquear agora
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={() => void saveFinanceSettings({ pinHash: undefined, lockOnOpen: false })}
      >
        Remover PIN
      </Button>
    </div>
  )
}
