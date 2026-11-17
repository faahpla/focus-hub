import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileText,
  Layers,
  Loader2,
  Maximize2,
  Plus,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/rich-text-editor'
import { ExportTextButton } from '@/components/export-text-button'
import { useAppStore } from '@/stores/app-store'
import { useNavigatorStore } from '@/stores/navigator-store'
import { useToastStore } from '@/stores/toast-store'
import { useAutosavedText } from '@/hooks/use-autosave'
import { copyRichText } from '@/lib/rich-text'
import { cn } from '@/lib/utils'
import type { Board, BoardCard } from '@shared/types'
import { assembledScript, partsOf, wordCount } from './compilations'
import { CompilationShelf } from './compilation-shelf'
import { ScriptReader } from './script-reader'

/** "1min 40s" of voice-over at a comfortable pace. */
function speakingTime(words: number): string {
  const seconds = Math.round((words / 150) * 60)
  if (seconds < 60) return `${seconds}s`
  const rest = seconds % 60
  return rest ? `${Math.floor(seconds / 60)}min ${rest}s` : `${seconds / 60}min`
}

/**
 * The left side of a compilation's card: putting the TikTok together.
 *
 * "Montagem" holds the parts in playing order, between an opening hook and a
 * closing. "Roteiro completo" is everything joined, read straight from the
 * parts — edit a short and it shows here, nothing is copied.
 */
export function CompilationPane({ card, board }: { card: BoardCard; board: Board }): JSX.Element {
  const cards = useAppStore((s) => s.cards)
  const saveCard = useAppStore((s) => s.saveCard)
  const openCard = useNavigatorStore((s) => s.openCard)
  const push = useToastStore((s) => s.push)
  const [tab, setTab] = useState<'parts' | 'script'>('parts')
  const [adding, setAdding] = useState(false)
  const [reading, setReading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)

  /** Save on top of the freshest copy, so a quick series of moves never loses one. */
  const update = (patch: Partial<BoardCard>): void => {
    const fresh = useAppStore.getState().cards.find((c) => c.id === card.id) ?? card
    void saveCard({ ...fresh, ...patch })
  }

  const [hook, setHook] = useAutosavedText(card.hook ?? '', (next) => update({ hook: next }))
  const [outro, setOutro] = useAutosavedText(card.outro ?? '', (next) => update({ outro: next }))

  const parts = useMemo(() => partsOf(card, cards), [card, cards])
  const script = useMemo(
    () => assembledScript({ ...card, hook, outro }, cards),
    [card, cards, hook, outro]
  )
  const words =
    wordCount(hook) + parts.reduce((n, p) => n + wordCount(p.notes), 0) + wordCount(outro)

  const move = (index: number, delta: number): void => {
    const ids = parts.map((p) => p.id)
    const to = index + delta
    if (to < 0 || to >= ids.length) return
    ;[ids[index], ids[to]] = [ids[to], ids[index]]
    update({ parts: ids })
  }

  const remove = (id: string): void => update({ parts: (card.parts ?? []).filter((p) => p !== id) })

  const downloadAll = async (): Promise<void> => {
    setDownloading(true)
    const res = await window.focusHub.downloadCompilation(card.id)
    setDownloading(false)
    if (res.ok) {
      push({
        title: `${res.count} arquivo(s) baixado(s)`,
        lines: ['Numerados pela ordem das partes.'],
        variant: 'success'
      })
    } else if (res.error) {
      push({ title: 'Não deu para baixar tudo', lines: [res.error], variant: 'warning' })
    }
  }

  const tabClass = (on: boolean): string =>
    cn(
      'no-drag flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium transition-colors',
      on ? 'bg-surface-elevated text-foreground' : 'text-muted-foreground hover:text-foreground'
    )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => setTab('parts')} className={tabClass(tab === 'parts')}>
            <Layers className="h-4 w-4 opacity-70" /> Montagem
          </button>
          <button onClick={() => setTab('script')} className={tabClass(tab === 'script')}>
            <FileText className="h-4 w-4 opacity-70" /> Roteiro completo
          </button>
        </div>
        {tab === 'script' && (
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                await copyRichText(script)
                setCopied(true)
                setTimeout(() => setCopied(false), 1400)
              }}
              className="no-drag flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <ExportTextButton folder={card.title} name="Roteiro TikTok" value={script} />
            <button
              onClick={() => setReading(true)}
              className="no-drag flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <Maximize2 className="h-3 w-3" /> Modo leitura
            </button>
          </div>
        )}
      </div>

      {tab === 'parts' ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 scrollbar-thin">
          <Section
            label="Gancho de abertura"
            hint="O que prende nos primeiros segundos, antes da parte 1."
          >
            <textarea
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              rows={3}
              placeholder="Ex.: Três momentos em que o Rimuru quase perdeu tudo…"
              className="no-drag w-full resize-y rounded-xl border border-input bg-surface/60 px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
            />
          </Section>

          <Section
            label={`Partes (${parts.length})`}
            hint="Na ordem em que tocam. Cada parte é um card curto."
          >
            <div className="space-y-1.5">
              {parts.map((part, i) => {
                const column = board.columns.find((c) => c.id === part.columnId)
                return (
                  <div
                    key={part.id}
                    className="group flex items-center gap-3 rounded-xl border border-border/70 bg-surface/40 px-3 py-2"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <button
                      onClick={() => openCard(part.id)}
                      className="no-drag min-w-0 flex-1 text-left"
                      title="Abrir a parte"
                    >
                      <p className="truncate text-sm font-medium hover:text-primary">
                        {part.title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {column && (
                          <span className="flex items-center gap-1">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: `hsl(${column.color})` }}
                            />
                            {column.name}
                          </span>
                        )}
                        <span>· {wordCount(part.notes)} palavras</span>
                        {(part.attachments?.length ?? 0) > 0 && (
                          <span>· {part.attachments!.length} arquivo(s)</span>
                        )}
                      </p>
                    </button>
                    <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                      <IconButton label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        label="Descer"
                        disabled={i === parts.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        label="Tirar do compilado (o card continua no quadro)"
                        onClick={() => remove(part.id)}
                        danger
                      >
                        <X className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  </div>
                )
              })}
              {parts.length === 0 && (
                <p className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
                  Nenhuma parte ainda.
                </p>
              )}
              <button
                onClick={() => setAdding(true)}
                className="no-drag flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/70 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar partes
              </button>
            </div>
          </Section>

          <Section label="Fechamento" hint="O CTA depois da última parte.">
            <textarea
              value={outro}
              onChange={(e) => setOutro(e.target.value)}
              rows={2}
              placeholder="Ex.: Comenta qual dos três foi o pior…"
              className="no-drag w-full resize-y rounded-xl border border-input bg-surface/60 px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
            />
          </Section>
        </div>
      ) : (
        <RichTextEditor
          value={script}
          onChange={() => undefined}
          editable={false}
          className="min-h-0 w-full flex-1 overflow-y-auto rounded-xl border border-input bg-surface/60 px-4 py-3 text-sm leading-relaxed scrollbar-thin"
        />
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {words} palavras · ~{speakingTime(words)} de locução
          {tab === 'script' && ' · montado das partes: edite cada parte no card dela'}
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void downloadAll()}
          disabled={downloading || parts.length === 0}
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Baixar arquivos das partes
        </Button>
      </div>

      {adding && (
        <CompilationShelf board={board} compilation={card} onClose={() => setAdding(false)} />
      )}
      {reading && (
        <ScriptReader
          rich
          readOnly
          title={card.title}
          exportName="Roteiro TikTok"
          value={script}
          onCommit={() => undefined}
          onClose={() => setReading(false)}
        />
      )}
    </div>
  )
}

function Section({
  label,
  hint,
  children
}: {
  label: string
  hint: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div>
      <p className="text-xs font-semibold">{label}</p>
      <p className="mb-1.5 text-[11px] text-muted-foreground">{hint}</p>
      {children}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'no-drag flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors disabled:opacity-25',
        danger
          ? 'hover:bg-destructive/10 hover:text-destructive'
          : 'hover:bg-surface-hover hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}
