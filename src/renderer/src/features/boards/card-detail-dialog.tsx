import { useMemo, useRef, useState } from 'react'
import {
  CalendarPlus,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  Hash,
  Maximize2,
  Paperclip,
  Star,
  Trash2,
  Type,
  X
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { addDaysToKey, dayLabel, today } from '@/lib/dates'
import { CardTasksPanel } from '@/features/planner/components/card-tasks-panel'
import { useAppStore } from '@/stores/app-store'
import { useAutosavedText } from '@/hooks/use-autosave'
import type { Board, BoardCard, CardAsset } from '@shared/types'
import { isCardDone } from './board-templates'
import { ScriptReader } from './script-reader'
import { cn, uid } from '@/lib/utils'

/** Small copy-to-clipboard affordance used next to every publishable field. */
function CopyButton({ value, label }: { value: string; label?: string }): JSX.Element {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        if (!value) return
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }}
      disabled={!value}
      className="no-drag flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-30"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-success" /> Copiado
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" /> {label ?? 'Copiar'}
        </>
      )}
    </button>
  )
}

export function CardDetailDialog({
  cardId,
  board,
  onClose
}: {
  cardId: string
  board: Board
  onClose: () => void
}): JSX.Element | null {
  const card = useAppStore((s) => s.cards.find((c) => c.id === cardId))
  // Resolve the card before the editor mounts, so the autosave hooks below can
  // run unconditionally and seed themselves from a card that definitely exists.
  if (!card) return null
  return <CardEditor card={card} board={board} onClose={onClose} />
}

function CardEditor({
  card,
  board,
  onClose
}: {
  card: BoardCard
  board: Board
  onClose: () => void
}): JSX.Element {
  const cardId = card.id
  const saveCard = useAppStore((s) => s.saveCard)
  const deleteCard = useAppStore((s) => s.deleteCard)

  const [tagDraft, setTagDraft] = useState('')
  const [readerOpen, setReaderOpen] = useState(false)
  const writeQueue = useRef<Promise<void>>(Promise.resolve())

  const assets = card.assets ?? []
  const column = board.columns.find((c) => c.id === card.columnId)
  const finished = isCardDone(card, board.columns)

  /**
   * Serialize writes and rebase each one on the freshest card from the store.
   * Saving is an async IPC round trip, so two appends fired in the same tick
   * would otherwise both start from the same array and the second would drop
   * the first entry.
   */
  const patchWith = (produce: (current: BoardCard) => Partial<BoardCard>): void => {
    writeQueue.current = writeQueue.current.then(async () => {
      const base = useAppStore.getState().cards.find((c) => c.id === cardId)
      if (!base) return
      const current = { ...base, assets: base.assets ?? [] }
      await saveCard({ ...current, ...produce(current) })
    })
  }

  const patch = (p: Partial<BoardCard>): void => patchWith(() => p)

  // Every free-text field autosaves; nothing waits for a blur that may never come.
  const [title, setTitle] = useAutosavedText(card.title, (next) => {
    const t = next.trim()
    if (t && t !== card.title) patch({ title: t })
  })
  const [notes, setNotes] = useAutosavedText(card.notes ?? '', (next) =>
    patch({ notes: next })
  )
  const [publishTitle, setPublishTitle] = useAutosavedText(card.publishTitle ?? '', (next) =>
    patch({ publishTitle: next })
  )
  const [description, setDescription] = useAutosavedText(card.description ?? '', (next) =>
    patch({ description: next })
  )
  const [hashtags, setHashtags] = useAutosavedText(card.hashtags ?? '', (next) =>
    patch({ hashtags: next })
  )

  const addTag = (): void => {
    const tag = tagDraft.trim()
    if (tag) {
      patchWith((c) => (c.tags.includes(tag) ? {} : { tags: [...c.tags, tag] }))
    }
    setTagDraft('')
  }

  const addAsset = (rawValue: string): void => {
    const value = rawValue.trim()
    if (!value) return

    const isLink = /^https?:\/\//i.test(value)
    // Drive letter (C:\…), UNC share (\\…) or a posix-ish absolute path.
    const isPath = !isLink && /^([a-zA-Z]:[\\/]|\\\\|\/)/.test(value)

    let label = value
    if (isLink) {
      try {
        label = new URL(value).hostname.replace(/^www\./, '')
      } catch {
        /* keep the raw value as the label */
      }
    } else if (isPath) {
      label = value.split(/[\\/]/).pop() || value
    }

    const kind: CardAsset['kind'] = isLink ? 'link' : isPath ? 'path' : 'text'
    patchWith((c) => ({ assets: [...c.assets, { id: uid(), label, value, kind }] }))
  }

  const pickAsset = async (kind: 'file' | 'folder'): Promise<void> => {
    const picked = await window.focusHub.pickPath(kind)
    if (picked) addAsset(picked)
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="flex h-[86vh] max-w-5xl flex-col overflow-hidden p-0">
          {/* Header */}
          <div className="shrink-0 border-b border-border px-6 py-4 pr-14">
            <DialogHeader className="mb-0">
              <DialogTitle className="sr-only">Editar card</DialogTitle>
              <DialogDescription className="sr-only">
                Edite o roteiro, a descrição, as hashtags e os assets do card.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-3">
              <button
                onClick={() => patch({ done: !finished })}
                className={cn(
                  'mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                  finished
                    ? 'border-success bg-success text-white'
                    : 'border-border hover:border-success/70'
                )}
                title={finished ? 'Marcar como não concluído' : 'Marcar como concluído'}
              >
                {finished && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </button>
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => !title.trim() && setTitle(card.title)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.currentTarget.blur()
                  }
                }}
                rows={1}
                placeholder="Título do card"
                className={cn(
                  'no-drag w-full resize-none bg-transparent text-lg font-semibold tracking-tight focus:outline-none',
                  finished && 'text-muted-foreground line-through'
                )}
              />
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>em</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="no-drag flex items-center gap-1.5 rounded-lg bg-surface-elevated px-2 py-1 text-foreground transition-colors hover:bg-surface-hover">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: `hsl(${column?.color ?? '0 0% 50%'})` }}
                    />
                    {column?.name ?? '—'}
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Mover para</DropdownMenuLabel>
                  {[...board.columns]
                    .sort((a, b) => a.order - b.order)
                    .map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        active={c.id === card.columnId}
                        onSelect={() => patch({ columnId: c.id })}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: `hsl(${c.color})` }}
                          />
                          {c.name}
                        </span>
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Delivery lives in the header because it is the decision that
                  puts this card on the day — burying it in the side rail meant
                  nobody found it. */}
              <span className="text-border">·</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'no-drag flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors',
                      card.dueDate
                        ? 'bg-primary/15 text-primary hover:bg-primary/25'
                        : 'bg-surface-elevated text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                    )}
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                    {card.dueDate
                      ? `${dayLabel(card.dueDate)}${card.dueTime ? ` · ${card.dueTime}` : ''}`
                      : 'Sem data'}
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Entregar em</DropdownMenuLabel>
                  <DropdownMenuItem
                    active={card.dueDate === today()}
                    onSelect={() => patch({ dueDate: today() })}
                  >
                    Hoje
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    active={card.dueDate === addDaysToKey(today(), 1)}
                    onSelect={() => patch({ dueDate: addDaysToKey(today(), 1) })}
                  >
                    Amanhã
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => patch({ dueDate: addDaysToKey(today(), 7) })}
                  >
                    Daqui a uma semana
                  </DropdownMenuItem>
                  {card.dueDate && (
                    <DropdownMenuItem
                      className="text-destructive data-[highlighted]:bg-destructive/10"
                      onSelect={() => patch({ dueDate: undefined, dueTime: undefined })}
                    >
                      Tirar da Agenda
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Body: script on the left, everything else on the right */}
          <div className="flex min-h-0 flex-1">
            {/* Script */}
            <div className="flex min-w-0 flex-1 flex-col p-6">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <FileText className="h-4 w-4 text-muted-foreground" /> Roteiro
                </p>
                <div className="flex items-center gap-1">
                  <CopyButton value={notes} />
                  <button
                    onClick={() => setReaderOpen(true)}
                    className="no-drag flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                  >
                    <Maximize2 className="h-3 w-3" /> Modo leitura
                  </button>
                </div>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => notes !== (card.notes ?? '') && patch({ notes })}
                placeholder="Escreva ou cole seu roteiro aqui…"
                className="no-drag min-h-0 w-full flex-1 resize-none rounded-xl border border-input bg-surface/60 px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none scrollbar-thin"
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                {notes.trim() ? `${notes.trim().split(/\s+/).length} palavras` : 'Vazio'} · Modo
                leitura abre em tela cheia com texto grande
              </p>
            </div>

            {/* Side rail */}
            <div className="w-[340px] shrink-0 space-y-5 overflow-y-auto border-l border-border/70 p-5 scrollbar-thin">
              {/* Tasks — a card is a deliverable made of several steps. */}
              <CardTasksPanel card={card} board={board} onClose={onClose} />

              {/* Publish title — separate from the card's own name, which is
                  written to find it on the board, not to go on the video. */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Type className="h-3.5 w-3.5 text-muted-foreground" /> Título
                    <span className="text-[11px] font-normal text-muted-foreground">
                      opcional
                    </span>
                  </p>
                  <CopyButton value={publishTitle} />
                </div>
                <textarea
                  value={publishTitle}
                  onChange={(e) => setPublishTitle(e.target.value)}
                  onBlur={() =>
                    publishTitle !== (card.publishTitle ?? '') && patch({ publishTitle })
                  }
                  placeholder="O título que vai no vídeo…"
                  rows={2}
                  className="no-drag w-full resize-y rounded-xl border border-input bg-surface/60 px-3 py-2 text-sm leading-snug placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none scrollbar-thin"
                />
                {publishTitle.trim() && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {publishTitle.trim().length} caracteres
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Descrição
                  </p>
                  <CopyButton value={description} />
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() =>
                    description !== (card.description ?? '') && patch({ description })
                  }
                  placeholder="A descrição que vai no post…"
                  className="no-drag min-h-[260px] w-full resize-y rounded-xl border border-input bg-surface/60 px-3 py-2 text-xs leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none scrollbar-thin"
                />
              </div>

              {/* Hashtags */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" /> Hashtags
                  </p>
                  <CopyButton value={hashtags} />
                </div>
                <textarea
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  onBlur={() => hashtags !== (card.hashtags ?? '') && patch({ hashtags })}
                  placeholder="#tensura #anime #shorts"
                  className="no-drag min-h-[64px] w-full resize-y rounded-xl border border-input bg-surface/60 px-3 py-2 text-xs leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none scrollbar-thin"
                />
              </div>

              {/* Assets */}
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" /> Assets
                </p>
                <div className="mb-2 space-y-1.5">
                  {assets.map((asset) => (
                    <AssetRow
                      key={asset.id}
                      asset={asset}
                      onRemove={() =>
                        patchWith((c) => ({
                          assets: c.assets.filter((a) => a.id !== asset.id)
                        }))
                      }
                    />
                  ))}
                  {assets.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Thumbnail, trilha, footage, referências…
                    </p>
                  )}
                </div>
                <Input
                  placeholder="Link, caminho ou texto + Enter…"
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    addAsset(e.currentTarget.value)
                    e.currentTarget.value = ''
                  }}
                  className="h-9 text-xs"
                />
                <div className="mt-1.5 flex gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => void pickAsset('file')}
                  >
                    <FileText className="h-3.5 w-3.5" /> Arquivo
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => void pickAsset('folder')}
                  >
                    <Folder className="h-3.5 w-3.5" /> Pasta
                  </Button>
                </div>
              </div>

              {/* Delivery — the card's own slot on the planner, not its tasks'. */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Entrega</p>
                  <button
                    onClick={() => patch({ dueDate: today() })}
                    className="no-drag flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                    title="Coloca este card no seu dia de hoje"
                  >
                    <CalendarPlus className="h-3 w-3" /> Enviar para hoje
                  </button>
                </div>
                <DatePicker value={card.dueDate} onChange={(next) => patch({ dueDate: next })} />

                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="time"
                    value={card.dueTime ?? ''}
                    disabled={!card.dueDate}
                    onChange={(e) => patch({ dueTime: e.target.value || undefined })}
                    className="no-drag h-9 flex-1 rounded-xl border border-input bg-surface/60 px-3 text-sm tabular focus:border-primary/60 focus:outline-none disabled:opacity-40"
                  />
                  <select
                    value={card.durationMinutes ?? 60}
                    disabled={!card.dueDate}
                    onChange={(e) => patch({ durationMinutes: Number(e.target.value) })}
                    className="no-drag h-9 rounded-xl border border-input bg-surface/60 px-2 text-xs focus:border-primary/60 focus:outline-none disabled:opacity-40"
                  >
                    {[30, 60, 90, 120, 180, 240].map((m) => (
                      <option key={m} value={m}>
                        {m < 60 ? `${m}min` : `${m / 60}h`}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {card.dueDate
                    ? card.dueTime
                      ? `Aparece na Agenda em ${dayLabel(card.dueDate)} às ${card.dueTime}.`
                      : `Aparece na Agenda em ${dayLabel(card.dueDate)}. Defina a hora para virar um bloco no horário.`
                    : 'Sem data o card não aparece na Agenda.'}
                </p>
              </div>

              {/* Tags */}
              <div>
                <p className="mb-1.5 text-sm font-medium">Tags internas</p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {card.tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 rounded-lg bg-surface-elevated px-2 py-1 text-xs"
                    >
                      #{tag}
                      <button
                        onClick={() =>
                          patchWith((c) => ({ tags: c.tags.filter((x) => x !== tag) }))
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {card.tags.length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      Só para organizar aqui dentro.
                    </span>
                  )}
                </div>
                <Input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Adicionar tag e Enter…"
                  className="h-9 text-xs"
                />

                <TagPresets
                  current={card.tags}
                  draft={tagDraft}
                  onPick={(tag) =>
                    patchWith((c) => (c.tags.includes(tag) ? {} : { tags: [...c.tags, tag] }))
                  }
                  onClearDraft={() => setTagDraft('')}
                />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-border px-6 py-3">
            <Button
              variant="ghost"
              onClick={() => {
                void deleteCard(card.id)
                onClose()
              }}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> Excluir card
            </Button>
            <Button variant="primary" onClick={onClose}>
              Concluído
            </Button>
          </div>

          {/* Rendered inside the dialog so Radix keeps focus here while reading. */}
          {readerOpen && (
            <ScriptReader
              title={card.title}
              value={notes}
              // Sync the card's box AND persist immediately. Routing this
              // through the card's debounce instead would stack two delays
              // before the script reaches disk.
              onCommit={(next) => {
                setNotes(next)
                patch({ notes: next })
              }}
              onClose={() => setReaderOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

    </>
  )
}

function AssetRow({
  asset,
  onRemove
}: {
  asset: CardAsset
  onRemove: () => void
}): JSX.Element {
  // Older entries predate `kind`; fall back to sniffing the value.
  const kind = asset.kind ?? (/^https?:\/\//i.test(asset.value) ? 'link' : 'path')
  const Icon = kind === 'link' ? ExternalLink : kind === 'path' ? Folder : Type

  return (
    <div className="group flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface/40 px-2 py-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-xs" title={asset.value}>
        {asset.label}
      </span>
      {kind !== 'text' && (
        <button
          onClick={() => void window.focusHub.openPath(asset.value)}
          className="no-drag shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-all hover:text-foreground group-hover:opacity-100"
          title="Abrir"
        >
          <ExternalLink className="h-3 w-3" />
        </button>
      )}
      <CopyButton value={asset.value} label="" />
      <button
        onClick={onRemove}
        className="no-drag shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
        title="Remover"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

/**
 * One-click tags.
 *
 * Two sources, deliberately: presets the user pinned, and the tags already in
 * use on other cards. The second costs nothing to maintain and covers the
 * common case — you almost always tag with something you've tagged before.
 */
function TagPresets({
  current,
  draft,
  onPick,
  onClearDraft
}: {
  current: string[]
  draft: string
  onPick: (tag: string) => void
  onClearDraft: () => void
}): JSX.Element {
  const cards = useAppStore((s) => s.cards)
  const presets = useAppStore((s) => s.settings.cardTagPresets)
  const saveSettings = useAppStore((s) => s.saveSettings)
  const [managing, setManaging] = useState(false)

  // Tags used elsewhere, most frequent first.
  const used = useMemo(() => {
    const counts = new Map<string, number>()
    for (const card of cards) {
      for (const tag of card.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .map(([tag]) => tag)
  }, [cards])

  const pinned = presets.filter((t) => !current.includes(t))
  const suggestions = used.filter((t) => !current.includes(t) && !presets.includes(t)).slice(0, 8)
  const trimmedDraft = draft.trim()
  const canPin = trimmedDraft.length > 0 && !presets.includes(trimmedDraft)

  const setPresets = (next: string[]): void => void saveSettings({ cardTagPresets: next })

  return (
    <div className="mt-2">
      {(pinned.length > 0 || suggestions.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {pinned.map((tag) => (
            <button
              key={tag}
              onClick={() => onPick(tag)}
              className="no-drag flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary transition-colors hover:bg-primary/20"
            >
              <Star className="h-2.5 w-2.5 fill-current" />#{tag}
            </button>
          ))}
          {suggestions.map((tag) => (
            <button
              key={tag}
              onClick={() => onPick(tag)}
              className="no-drag rounded-lg border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-2">
        {canPin && (
          <button
            onClick={() => {
              setPresets([...presets, trimmedDraft])
              onPick(trimmedDraft)
              onClearDraft()
            }}
            className="no-drag flex items-center gap-1 text-[11px] text-primary transition-colors hover:underline"
          >
            <Star className="h-2.5 w-2.5" /> Fixar “{trimmedDraft}”
          </button>
        )}
        <button
          onClick={() => setManaging((m) => !m)}
          className="no-drag ml-auto text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {managing ? 'Fechar' : 'Editar fixas'}
        </button>
      </div>

      {managing && (
        <div className="mt-2 rounded-lg border border-border/70 bg-surface/50 p-2">
          <p className="mb-1.5 text-[11px] text-muted-foreground">
            Tags fixas aparecem em todos os cards. Separe por vírgula.
          </p>
          <Input
            defaultValue={presets.join(', ')}
            placeholder="tensura, mushoku tensei, bleach"
            onBlur={(e) =>
              setPresets(
                e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
              )
            }
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="h-8 text-xs"
          />
        </div>
      )}
    </div>
  )
}
