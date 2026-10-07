import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlignLeft,
  CalendarPlus,
  Check,
  ChevronDown,
  Clapperboard,
  Copy,
  FileText,
  ListChecks,
  Maximize2,
  MessageSquare,
  Paperclip,
  Play,
  Trash2,
  Type,
  UserRound,
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
import { TimeField } from '@/components/ui/time-field'
import { addDaysToKey, dayLabel, today } from '@/lib/dates'
import { ChecklistPanel } from '@/features/session/checklist-panel'
import { useAppStore } from '@/stores/app-store'
import { useSyncStore } from '@/stores/sync-store'
import { peopleOf, personOf } from '@/features/sharing/people'
import { PersonAvatar, PersonChip } from '@/features/sharing/person-badge'
import { useSessionStore } from '@/stores/session-store'
import { useAutosavedText } from '@/hooks/use-autosave'
import type { Board, BoardCard, CardAsset } from '@shared/types'
import { canOnBoard, isCardCancelled, isCardDone } from './board-templates'
import { AssetsDropZone, CardAttachments } from './card-attachments'
import { QuickPicks, byUse } from './quick-picks'
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
  const projects = useAppStore((s) => s.projects)
  const defaultMinutes = useAppStore((s) => s.settings.defaultDurationMinutes)
  const configure = useSessionStore((s) => s.configure)
  const navigate = useNavigate()
  const deleteCard = useAppStore((s) => s.deleteCard)

  const [tagDraft, setTagDraft] = useState('')
  const [readerOpen, setReaderOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [tagEdit, setTagEdit] = useState('')
  const [pane, setPane] = useState<'Roteiro' | 'Resumo' | 'B-roll'>('Roteiro')
  const writeQueue = useRef<Promise<void>>(Promise.resolve())

  const assets = card.assets ?? []
  const checklist = card.checklist ?? []
  const column = board.columns.find((c) => c.id === card.columnId)
  const finished = isCardDone(card, board.columns)
  const me = useSyncStore((s) => s.status.userId)
  const people = peopleOf(board, me)
  const assignee = personOf(board, card.assigneeId, me)
  const dropped = isCardCancelled(card, board.columns)

  /** Take this card into a focus session — the card *is* the work. */
  const focusOnCard = (): void => {
    configure({
      project: projects.find((p) => p.id === board.projectId),
      card,
      minutes: card.durationMinutes ?? defaultMinutes
    })
    onClose()
    navigate('/foco')
  }

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
  const [pinnedComment, setPinnedComment] = useAutosavedText(card.pinnedComment ?? '', (next) =>
    patch({ pinnedComment: next })
  )
  const [summary, setSummary] = useAutosavedText(card.summary ?? '', (next) =>
    patch({ summary: next })
  )
  const [bRoll, setBRoll] = useAutosavedText(card.bRoll ?? '', (next) => patch({ bRoll: next }))

  /** The panes that share the left column, in tab order. */
  const panes = {
    Roteiro: {
      icon: FileText,
      value: notes,
      set: setNotes,
      field: 'notes',
      placeholder: 'Escreva ou cole seu roteiro aqui…',
      hint: 'Modo leitura abre em tela cheia com texto grande'
    },
    Resumo: {
      icon: AlignLeft,
      value: summary,
      set: setSummary,
      field: 'summary',
      placeholder: 'Do que é este vídeo, em poucas linhas…',
      hint: 'A ideia do vídeo em poucas linhas, para bater o olho e lembrar'
    },
    'B-roll': {
      icon: Clapperboard,
      value: bRoll,
      set: setBRoll,
      field: 'bRoll',
      placeholder: 'Uma tomada por linha: o que gravar ou buscar de apoio…',
      hint: 'As imagens de cobertura do vídeo — o que gravar ou buscar'
    }
  } as const
  const current = panes[pane]

  // One line, one entry - see linesToAssets.
  const [assetsText, setAssetsText] = useAutosavedText(
    assets.map((a) => a.value).join('\n'),
    (next) => patchWith((c) => ({ assets: linesToAssets(next, c.assets ?? []) }))
  )

  /**
   * Rename a tag on this card. Renaming it to one the card already has merges
   * the two; emptied out, the edit is dropped — removing is the ✕'s job.
   */
  const commitTagEdit = (): void => {
    const from = editingTag
    const to = tagEdit.trim().replace(/^#+/, '')
    setEditingTag(null)
    if (!from || !to || to === from) return
    patchWith((c) => ({
      tags: c.tags.includes(to)
        ? c.tags.filter((t) => t !== from)
        : c.tags.map((t) => (t === from ? to : t))
    }))
  }

  const addTag = (): void => {
    const tag = tagDraft.trim()
    if (tag) {
      patchWith((c) => (c.tags.includes(tag) ? {} : { tags: [...c.tags, tag] }))
    }
    setTagDraft('')
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
                Edite o roteiro, o resumo, o B-roll, a descrição e os assets do card.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-3">
              {/*
                A dropped card shows the state instead of offering the tick:
                concluding something you abandoned is not a move that makes
                sense, and the way back is dragging it out of the column.
              */}
              {dropped ? (
                <span
                  className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-destructive bg-destructive text-white"
                  title="Card dropado — tire da coluna de cancelados para retomar"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              ) : (
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
              )}
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
                  (finished || dropped) && 'text-muted-foreground line-through',
                  dropped && 'decoration-destructive/60'
                )}
              />
              <div className="mt-1 shrink-0">
                <CopyButton value={title.trim()} />
              </div>
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

              {/* Whose card it is — only a shared board has anyone to choose. */}
              {people.length > 0 && (
                <>
                  <span className="text-border">·</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      {assignee ? (
                        <button className="no-drag flex items-center rounded-lg transition-opacity hover:opacity-80">
                          <PersonChip person={assignee} />
                          <ChevronDown className="ml-0.5 h-3 w-3 opacity-60" />
                        </button>
                      ) : (
                        <button className="no-drag flex items-center gap-1.5 rounded-lg bg-surface-elevated px-2 py-1 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground">
                          <UserRound className="h-3.5 w-3.5" />
                          Sem responsável
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </button>
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Responsável</DropdownMenuLabel>
                      {people.map((person) => (
                        <DropdownMenuItem
                          key={person.userId}
                          active={card.assigneeId === person.userId}
                          onSelect={() => patch({ assigneeId: person.userId })}
                        >
                          <span className="flex items-center gap-2">
                            <PersonAvatar person={person} />
                            {person.label}
                          </span>
                        </DropdownMenuItem>
                      ))}
                      {card.assigneeId && (
                        <DropdownMenuItem onSelect={() => patch({ assigneeId: undefined })}>
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <UserRound className="h-4 w-4" /> Ninguém
                          </span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>

          {/* Body: script on the left, everything else on the right */}
          <div className="flex min-h-0 flex-1">
            {/* Script */}
            <div className="flex min-w-0 flex-1 flex-col p-6">
              {/*
                Panes over the same space: the script, a short summary and the
                B-roll list. They're different lengths and read at different
                moments, so tabs beat stacking them and splitting the room.
              */}
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {(Object.keys(panes) as (keyof typeof panes)[]).map((t) => {
                    const { icon: Icon, value } = panes[t]
                    const filled = value.trim()
                    return (
                      <button
                        key={t}
                        onClick={() => setPane(t)}
                        className={cn(
                          'no-drag flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium transition-colors',
                          pane === t
                            ? 'bg-surface-elevated text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4 opacity-70" />
                        {t}
                        {filled && pane !== t && (
                          <span className="h-1 w-1 rounded-full bg-primary" />
                        )}
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-1">
                  <CopyButton value={current.value} />
                  {pane === 'Roteiro' && (
                    <button
                      onClick={() => setReaderOpen(true)}
                      className="no-drag flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                    >
                      <Maximize2 className="h-3 w-3" /> Modo leitura
                    </button>
                  )}
                </div>
              </div>
              {/* Keyed so switching tabs swaps the field instead of reusing it
                  with the old pane's scroll and selection. */}
              <textarea
                key={pane}
                value={current.value}
                onChange={(e) => current.set(e.target.value)}
                onBlur={() =>
                  current.value !== (card[current.field] ?? '') &&
                  patch({ [current.field]: current.value })
                }
                placeholder={current.placeholder}
                className="no-drag min-h-0 w-full flex-1 resize-none rounded-xl border border-input bg-surface/60 px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none scrollbar-thin"
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                {!current.value.trim()
                  ? 'Vazio'
                  : pane === 'Roteiro'
                    ? `${current.value.trim().split(/\s+/).length} palavras`
                    : pane === 'B-roll'
                      ? `${current.value.split('\n').filter((l) => l.trim()).length} tomadas`
                      : `${current.value.trim().length} caracteres`}{' '}
                · {current.hint}
              </p>
            </div>

            {/* Side rail */}
            <div className="w-[340px] shrink-0 space-y-5 overflow-y-auto overflow-x-hidden border-l border-border/70 p-5 scrollbar-thin">
              {/*
                Etapas as a plain checklist. This used to spawn one real Task
                per step — schedulable, with dependencies and lock icons — which
                turned a single video into six items to manage. The card is the
                task; these are just things to tick while focusing on it.
              */}
              <div className="rounded-xl border border-border/70 bg-surface/40 p-3.5">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <ListChecks className="h-4 w-4 text-primary" /> Etapas
                    {checklist.length > 0 && (
                      <span className="text-[11px] font-normal tabular text-muted-foreground">
                        {checklist.filter((c) => c.done).length}/{checklist.length}
                      </span>
                    )}
                  </p>
                  <Button size="sm" variant="secondary" onClick={focusOnCard} className="h-7">
                    <Play className="h-3.5 w-3.5" /> Focar
                  </Button>
                </div>
                <ChecklistPanel
                  items={checklist}
                  onChange={(next) => patch({ checklist: next })}
                  compact
                  showHeader={false}
                  placeholder="Adicionar etapa e Enter…"
                />
                <StepPresets
                  current={checklist.map((c) => c.label)}
                  onPick={(label) =>
                    patchWith((c) => ({
                      checklist: [...(c.checklist ?? []), { id: uid(), label, done: false }]
                    }))
                  }
                />
              </div>

              {/*
                Assets is a plain list of lines, not attachments. Every entry
                ever written here was text - hook variants, title ideas - and
                not one was a file or a link, so the row list, the
                Enter-to-add box and the file/folder pickers were friction
                wrapped around a notepad. It stays stored as CardAsset[]
                because the board badge counts the entries.
              */}
              <AssetsDropZone card={card} board={board}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" /> Assets
                    {assets.length > 0 && (
                      <span className="text-[11px] font-normal tabular text-muted-foreground">
                        {assets.length}
                      </span>
                    )}
                  </p>
                  <CopyButton value={assetsText} />
                </div>
                <textarea
                  value={assetsText}
                  onChange={(e) => setAssetsText(e.target.value)}
                  placeholder="Uma por linha: gancho, titulo, referencia..."
                  className="no-drag min-h-[110px] w-full resize-y rounded-xl border border-input bg-surface/60 px-3 py-2 text-xs leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none scrollbar-thin"
                />
                {/* Files — audio, thumbnail, notes — live apart from the text above. */}
                <CardAttachments card={card} board={board} />
              </AssetsDropZone>

              {/* Publish title — separate from the card's own name, which is
                  written to find it on the board, not to go on the video. */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Type className="h-3.5 w-3.5 text-muted-foreground" /> TikTok
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
                  rows={10}
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
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" /> YouTube
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

              {/* Pinned comment — written last, pasted somewhere else. */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" /> Comentário
                    fixado
                  </p>
                  <CopyButton value={pinnedComment} />
                </div>
                <textarea
                  value={pinnedComment}
                  onChange={(e) => setPinnedComment(e.target.value)}
                  onBlur={() =>
                    pinnedComment !== (card.pinnedComment ?? '') && patch({ pinnedComment })
                  }
                  placeholder="O comentário que você fixa no post…"
                  className="no-drag min-h-[120px] w-full resize-y rounded-xl border border-input bg-surface/60 px-3 py-2 text-xs leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none scrollbar-thin"
                />
                {pinnedComment.trim() && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {pinnedComment.trim().length} caracteres
                  </p>
                )}
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
                  <TimeField
                    value={card.dueTime}
                    disabled={!card.dueDate}
                    onChange={(dueTime) => patch({ dueTime })}
                    className="flex-1"
                  />
                  <select
                    value={card.durationMinutes ?? 60}
                    disabled={!card.dueDate}
                    onChange={(e) => patch({ durationMinutes: Number(e.target.value) })}
                    className="no-drag h-9 shrink-0 rounded-xl border border-input bg-surface/60 px-2 text-xs focus:border-primary/60 focus:outline-none disabled:opacity-40"
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
                  {card.tags.map((tag) =>
                    editingTag === tag ? (
                      <input
                        key={tag}
                        autoFocus
                        value={tagEdit}
                        onChange={(e) => setTagEdit(e.target.value)}
                        onBlur={commitTagEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitTagEdit()
                          if (e.key === 'Escape') {
                            // Esc would close the whole card; here it only cancels.
                            e.stopPropagation()
                            setEditingTag(null)
                          }
                        }}
                        className="no-drag h-7 w-32 rounded-lg border border-primary/50 bg-surface-elevated px-2 text-xs focus:outline-none"
                      />
                    ) : (
                      <span
                        key={tag}
                        onDoubleClick={() => {
                          setEditingTag(tag)
                          setTagEdit(tag)
                        }}
                        title="Duplo clique para editar"
                        className="flex cursor-text select-none items-center gap-1 rounded-lg bg-surface-elevated px-2 py-1 text-xs"
                      >
                        #{tag}
                        <button
                          onClick={() =>
                            patchWith((c) => ({ tags: c.tags.filter((x) => x !== tag) }))
                          }
                          title="Remover"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )
                  )}
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
            {canOnBoard(board, 'deleteCards') ? (
              <div className="flex items-center gap-1">
                <Button
                  variant={confirmingDelete ? 'destructive' : 'ghost'}
                  onClick={() => {
                    // Asks twice: on a shared board this takes the card from everyone.
                    if (!confirmingDelete) return setConfirmingDelete(true)
                    void deleteCard(card.id)
                    onClose()
                  }}
                  className={cn(!confirmingDelete && 'text-destructive hover:bg-destructive/10')}
                >
                  <Trash2 className="h-4 w-4" />
                  {confirmingDelete ? 'Sim, excluir card' : 'Excluir card'}
                </Button>
                {confirmingDelete && (
                  <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                    Cancelar
                  </Button>
                )}
              </div>
            ) : (
              <span />
            )}
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

/**
 * One line, one asset.
 *
 * The field is stored as CardAsset[] and the board badge counts its length, so
 * the list shape stays; only the way it is edited changed. Ids are reused for
 * lines that did not change, so editing the last line does not rewrite every
 * entry in the document.
 */
function linesToAssets(text: string, previous: CardAsset[]): CardAsset[] {
  const spare = new Map<string, CardAsset[]>()
  for (const asset of previous) {
    const same = spare.get(asset.value) ?? []
    same.push(asset)
    spare.set(asset.value, same)
  }
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((value) => {
      const reused = spare.get(value)?.shift()
      return { id: reused?.id ?? uid(), label: value, value, kind: 'text' as const }
    })
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
  const settings = useAppStore((s) => s.settings)
  const saveSettings = useAppStore((s) => s.saveSettings)
  const used = useMemo(() => byUse(cards.flatMap((c) => c.tags)), [cards])
  return (
    <QuickPicks
      kind="tag"
      current={current}
      used={used}
      presets={settings.cardTagPresets}
      hidden={settings.cardTagHidden ?? []}
      onPick={onPick}
      onPresetsChange={(next) => void saveSettings({ cardTagPresets: next })}
      onHiddenChange={(next) => void saveSettings({ cardTagHidden: next })}
      draft={draft}
      onClearDraft={onClearDraft}
      suggestionLimit={8}
    />
  )
}

/**
 * One-click steps for a repeating production flow.
 *
 * Same idea as the tag presets: a pinned list you control, plus whatever you
 * already use on other cards, ordered by how often. Typing "Gravação" on every
 * single card is exactly the sort of friction this app exists to remove.
 */
function StepPresets({
  current,
  onPick
}: {
  current: string[]
  onPick: (label: string) => void
}): JSX.Element {
  const cards = useAppStore((s) => s.cards)
  const settings = useAppStore((s) => s.settings)
  const saveSettings = useAppStore((s) => s.saveSettings)
  const used = useMemo(
    () => byUse(cards.flatMap((c) => (c.checklist ?? []).map((step) => step.label))),
    [cards]
  )
  return (
    <QuickPicks
      kind="step"
      current={current}
      used={used}
      presets={settings.cardStepPresets}
      hidden={settings.cardStepHidden ?? []}
      onPick={onPick}
      onPresetsChange={(next) => void saveSettings({ cardStepPresets: next })}
      onHiddenChange={(next) => void saveSettings({ cardStepHidden: next })}
      suggestionLimit={6}
    />
  )
}
