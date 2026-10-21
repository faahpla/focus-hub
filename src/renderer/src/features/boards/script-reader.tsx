import { useEffect, useMemo, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  Check,
  Copy,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  X
} from 'lucide-react'
import { useAutosavedText } from '@/hooks/use-autosave'
import { cn } from '@/lib/utils'
import { RichTextEditor } from '@/components/rich-text-editor'
import { copyRichText, toPlainText } from '@/lib/rich-text'

const FONT_KEY = 'focus-hub:reader-font'
const SPEED_KEY = 'focus-hub:reader-speed'
const MIN_FONT = 14
const MAX_FONT = 48
const LINE_HEIGHT = 1.75
/** A comfortable voice-over pace, for the time estimate. */
const WORDS_PER_MINUTE = 150

function readStored(key: string, min: number, max: number, fallback: number): number {
  try {
    const saved = Number(localStorage.getItem(key))
    return saved >= min && saved <= max ? saved : fallback
  } catch {
    return fallback
  }
}

function store(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Only a preference; the reader works without it.
  }
}

/** "1min 40s" of voice-over for this many words. */
function speakingTime(words: number): string {
  const seconds = Math.round((words / WORDS_PER_MINUTE) * 60)
  if (seconds < 60) return `${seconds}s`
  const rest = seconds % 60
  return rest ? `${Math.floor(seconds / 60)}min ${rest}s` : `${seconds / 60}min`
}

/**
 * Reading surface for the card's script, built for recording the voice-over:
 * the whole screen, big type, and a teleprompter that scrolls by itself.
 * Still editable — the text autosaves and commits on close.
 *
 * It is a dialog of its own, portalled to the page. Drawn inside the card's
 * dialog it was trapped in that box — a fixed element inside a transformed
 * one is placed against the box, not the window — and the card's own header
 * showed through above it. As its own dialog it covers everything, and Radix
 * hands it the focus and the Escape key, so the card underneath stays open.
 *
 * A card's script is formatted text; a task's description is still plain, so
 * the reader takes whichever it is given.
 */
export function ScriptReader({
  title,
  value,
  onCommit,
  onClose,
  rich
}: {
  title: string
  value: string
  onCommit: (next: string) => void
  onClose: () => void
  rich?: boolean
}): JSX.Element {
  // Autosaved while you write — a shutdown mid-script must not cost the script.
  const [text, setText, flush] = useAutosavedText(value, onCommit)
  const [fontSize, setFontSize] = useState(() => readStored(FONT_KEY, MIN_FONT, MAX_FONT, 26))
  const [speed, setSpeed] = useState(() => readStored(SPEED_KEY, 1, 10, 4))
  const [scrolling, setScrolling] = useState(false)
  const [fullScreen, setFullScreen] = useState(true)
  const [progress, setProgress] = useState(0)
  const [copied, setCopied] = useState(false)
  const [scroller, setScroller] = useState<HTMLElement | null>(null)

  useEffect(() => store(FONT_KEY, fontSize), [fontSize])
  useEffect(() => store(SPEED_KEY, speed), [speed])

  // The window goes full screen with the reader and comes back with it.
  useEffect(() => {
    window.focusHub.setFullScreen(fullScreen)
  }, [fullScreen])
  useEffect(() => () => window.focusHub.setFullScreen(false), [])

  // Always close through here so any un-debounced text lands before we leave.
  const finish = (): void => {
    flush()
    onClose()
  }

  const words = useMemo(() => {
    const plain = (rich ? toPlainText(text) : text).trim()
    return plain ? plain.split(/\s+/).length : 0
  }, [text, rich])

  // How far down the text the view is, for the bar along the top.
  useEffect(() => {
    if (!scroller) return
    const update = (): void => {
      const room = scroller.scrollHeight - scroller.clientHeight
      setProgress(room > 0 ? scroller.scrollTop / room : 0)
    }
    update()
    scroller.addEventListener('scroll', update, { passive: true })
    return () => scroller.removeEventListener('scroll', update)
  }, [scroller])

  /*
    Teleprompter. Speed 1–10 maps to 0.04–0.4 lines a second; at the default
    width a line holds about a dozen words, so the middle of the range sits
    near a spoken pace. Measured in lines, so a bigger font still reads at
    the same speed. Fractions of a pixel are carried over between frames —
    scrollTop only moves in whole pixels and slow speeds would never start.
  */
  useEffect(() => {
    if (!scrolling || !scroller) return
    const pxPerSecond = fontSize * LINE_HEIGHT * 0.04 * speed
    let last = performance.now()
    let carry = 0
    let frame = requestAnimationFrame(function step(now) {
      carry += ((now - last) / 1000) * pxPerSecond
      last = now
      const whole = Math.floor(carry)
      if (whole > 0) {
        scroller.scrollTop += whole
        carry -= whole
      }
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) {
        setScrolling(false)
        return
      }
      frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [scrolling, scroller, speed, fontSize])

  const bump = (delta: number): void =>
    setFontSize((f) => Math.min(MAX_FONT, Math.max(MIN_FONT, f + delta)))

  // Shortcuts that don't fight typing: none of them is a plain letter.
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'F11') {
      e.preventDefault()
      setFullScreen((f) => !f)
    } else if (e.ctrlKey && e.key === ' ') {
      e.preventDefault()
      setScrolling((s) => !s)
    } else if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
      e.preventDefault()
      bump(2)
    } else if (e.ctrlKey && e.key === '-') {
      e.preventDefault()
      bump(-2)
    } else if (scrolling && !e.ctrlKey && !e.altKey && e.key.length === 1) {
      // Starting to type means stopping to read.
      setScrolling(false)
    }
  }

  const copy = async (): Promise<void> => {
    if (rich) await copyRichText(text)
    else await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  const tool =
    'no-drag flex h-8 items-center justify-center gap-1.5 rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-30'

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && finish()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          // Using the window's buttons is not leaving the reader.
          onInteractOutside={(e) => {
            const target = (e.detail.originalEvent.target ?? e.target) as Element | null
            if (target?.closest?.('[data-titlebar]')) e.preventDefault()
          }}
          aria-describedby={undefined}
          className={cn(
            'fixed z-[60] flex flex-col bg-background data-[state=open]:animate-fade-in focus:outline-none',
            // Out of full screen, the window's own buttons stay in reach above it.
            fullScreen ? 'inset-0' : 'inset-x-0 bottom-0 top-10'
          )}
        >
          <DialogPrimitive.Title className="sr-only">Modo leitura: {title}</DialogPrimitive.Title>

          {/* How far through the script you are. */}
          <div className="h-0.5 shrink-0 bg-border/40">
            <div
              className="h-full bg-primary transition-[width] duration-150"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 px-6 py-2.5">
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
              {title}
            </p>

            <div className="flex items-center gap-1">
              {/* Teleprompter */}
              <button
                onClick={() => setScrolling((s) => !s)}
                className={cn(
                  tool,
                  'px-2.5 text-xs font-medium',
                  scrolling && 'bg-primary/15 text-primary hover:bg-primary/25 hover:text-primary'
                )}
                title="Rolagem automática (Ctrl+Espaço)"
              >
                {scrolling ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {scrolling ? 'Pausar' : 'Rolar'}
              </button>
              <button
                onClick={() => setSpeed((v) => Math.max(1, v - 1))}
                disabled={speed <= 1}
                className={cn(tool, 'w-7')}
                aria-label="Mais devagar"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span
                className="w-14 text-center text-xs tabular text-muted-foreground"
                title="Velocidade da rolagem"
              >
                vel. {speed}
              </span>
              <button
                onClick={() => setSpeed((v) => Math.min(10, v + 1))}
                disabled={speed >= 10}
                className={cn(tool, 'w-7')}
                aria-label="Mais rápido"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>

              <span className="mx-2 h-4 w-px bg-border" />

              {/* Type size */}
              <button
                onClick={() => bump(-2)}
                disabled={fontSize <= MIN_FONT}
                className={cn(tool, 'w-7')}
                aria-label="Diminuir texto"
                title="Diminuir texto (Ctrl −)"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-12 text-center text-xs tabular text-muted-foreground">
                {fontSize}px
              </span>
              <button
                onClick={() => bump(2)}
                disabled={fontSize >= MAX_FONT}
                className={cn(tool, 'w-7')}
                aria-label="Aumentar texto"
                title="Aumentar texto (Ctrl +)"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>

              <span className="mx-2 h-4 w-px bg-border" />

              <button onClick={() => void copy()} className={cn(tool, 'px-2.5 text-xs')}>
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
                onClick={() => setFullScreen((f) => !f)}
                className={cn(tool, 'w-8')}
                aria-label={fullScreen ? 'Sair da tela cheia' : 'Tela cheia'}
                title={fullScreen ? 'Sair da tela cheia (F11)' : 'Tela cheia (F11)'}
              >
                {fullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={finish}
                className={cn(tool, 'w-8')}
                aria-label="Fechar modo leitura"
                title="Voltar ao card (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {rich ? (
            <RichTextEditor
              // From the top: a script is read from its first line.
              autoFocus="start"
              value={text}
              onChange={setText}
              onBlur={flush}
              placeholder="Escreva ou cole seu roteiro aqui…"
              style={{ fontSize, lineHeight: LINE_HEIGHT }}
              boxRef={setScroller}
              // Room under the last line, so the teleprompter can bring it up
              // to the middle of the screen instead of stopping at the bottom.
              className="min-h-0 flex-1 overflow-y-auto px-8 pb-[45vh] pt-12 scrollbar-thin"
              contentClassName="mx-auto max-w-3xl"
            />
          ) : (
            <textarea
              ref={setScroller}
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={flush}
              placeholder="Escreva ou cole seu roteiro aqui…"
              style={{ fontSize, lineHeight: LINE_HEIGHT }}
              className={cn(
                'no-drag mx-auto block min-h-0 w-full max-w-3xl flex-1 resize-none bg-transparent px-8 py-12 scrollbar-thin',
                'placeholder:text-muted-foreground/50 focus:outline-none'
              )}
            />
          )}

          <div className="flex shrink-0 items-center justify-center gap-3 border-t border-border/60 px-6 py-2 text-[11px] text-muted-foreground">
            <span className="tabular">
              {words} palavras · ~{speakingTime(words)} de locução
            </span>
            <span className="text-border">·</span>
            <span>Ctrl+Espaço rola · F11 tela cheia · Esc volta ao card</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
