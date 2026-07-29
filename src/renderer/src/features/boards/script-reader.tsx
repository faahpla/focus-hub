import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy, Minus, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const FONT_KEY = 'focus-hub:reader-font'
const MIN_FONT = 14
const MAX_FONT = 40

/**
 * Full-screen reading surface for the card's script. Built for locução: wide
 * line height, adjustable type size, nothing else on screen. Still editable —
 * the text commits on blur and on close.
 */
export function ScriptReader({
  title,
  value,
  onCommit,
  onClose
}: {
  title: string
  value: string
  onCommit: (next: string) => void
  onClose: () => void
}): JSX.Element {
  const [text, setText] = useState(value)
  const [fontSize, setFontSize] = useState(() => {
    const saved = Number(localStorage.getItem(FONT_KEY))
    return saved >= MIN_FONT && saved <= MAX_FONT ? saved : 22
  })
  const [copied, setCopied] = useState(false)

  // Always close through here so the text is saved exactly once, on the way out.
  const finish = useRef<() => void>(() => undefined)
  finish.current = () => {
    onCommit(text)
    onClose()
  }

  useEffect(() => {
    localStorage.setItem(FONT_KEY, String(fontSize))
  }, [fontSize])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // Capture Escape before Radix closes the whole card dialog underneath.
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        finish.current()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  const bump = (delta: number): void =>
    setFontSize((f) => Math.min(MAX_FONT, Math.max(MIN_FONT, f + delta)))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex flex-col bg-background"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border/60 px-6 py-3">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
          {title}
        </p>

        <div className="flex items-center gap-1">
          <button
            onClick={() => bump(-2)}
            disabled={fontSize <= MIN_FONT}
            className="no-drag flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-30"
            aria-label="Diminuir texto"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-xs tabular text-muted-foreground">
            {fontSize}px
          </span>
          <button
            onClick={() => bump(2)}
            disabled={fontSize >= MAX_FONT}
            className="no-drag flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-30"
            aria-label="Aumentar texto"
          >
            <Plus className="h-4 w-4" />
          </button>

          <button
            onClick={() => void copy()}
            className="no-drag ml-2 flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-success" /> Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </>
            )}
          </button>

          <button
            onClick={() => finish.current()}
            className="no-drag ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            aria-label="Fechar modo leitura"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => onCommit(text)}
          placeholder="Escreva ou cole seu roteiro aqui…"
          style={{ fontSize, lineHeight: 1.75 }}
          className={cn(
            'no-drag mx-auto block h-full w-full max-w-3xl resize-none bg-transparent px-8 py-10',
            'placeholder:text-muted-foreground/50 focus:outline-none'
          )}
        />
      </div>

      <div className="border-t border-border/60 px-6 py-2 text-center text-[11px] text-muted-foreground">
        Esc para voltar ao card
      </div>
    </motion.div>
  )
}
