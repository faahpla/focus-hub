import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  Hash,
  Link2,
  ListChecks,
  Maximize2,
  Paperclip,
  Play,
  Sparkles,
  Trash2,
  Type,
  Unlink,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { DynamicIcon } from '@/components/dynamic-icon'
import { TaskDetailDialog } from '@/features/projects/task-detail-dialog'
import { useAppStore } from '@/stores/app-store'
import { useAutosavedText } from '@/hooks/use-autosave'
import { useSessionStore } from '@/stores/session-store'
import { useToastStore } from '@/stores/toast-store'
import type { Board, BoardCard, CardAsset, Task } from '@shared/types'
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
  const allTasks = useAppStore((s) => s.tasks)
  const allProjects = useAppStore((s) => s.projects)
  const saveCard = useAppStore((s) => s.saveCard)
  const deleteCard = useAppStore((s) => s.deleteCard)
  const saveTask = useAppStore((s) => s.saveTask)
  const defaultMinutes = useAppStore((s) => s.settings.defaultDurationMinutes)
  const configure = useSessionStore((s) => s.configure)
  const pushToast = useToastStore((s) => s.push)
  const navigate = useNavigate()

  const [tagDraft, setTagDraft] = useState('')
  const [taskOpen, setTaskOpen] = useState(false)
  const [readerOpen, setReaderOpen] = useState(false)
  const writeQueue = useRef<Promise<void>>(Promise.resolve())

  const assets = card.assets ?? []
  const projects = allProjects.filter((p) => !p.archived)
  const linkedTask = card.taskId ? allTasks.find((t) => t.id === card.taskId) : undefined
  const boardProject = board.projectId
    ? projects.find((p) => p.id === board.projectId)
    : undefined
  const column = board.columns.find((c) => c.id === card.columnId)

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

  /** Promote this card into a real Task and link the two. */
  const convertToTask = async (projectId: string): Promise<void> => {
    const stamp = new Date().toISOString()
    const task: Task = {
      id: uid(),
      projectId,
      title: card.title,
      description: card.notes,
      checklist: [],
      priority: 'medium',
      status: 'todo',
      actualMinutes: 0,
      tags: [...card.tags],
      createdAt: stamp,
      updatedAt: stamp,
      order: allTasks.filter((t) => t.projectId === projectId).length
    }
    await saveTask(task)
    patch({ taskId: task.id })
    pushToast({
      title: 'Card virou tarefa',
      lines: ['Agora ele tem checklist, prioridade e pode virar sessão de foco.'],
      variant: 'success'
    })
  }

  const startSession = (): void => {
    if (!linkedTask) return
    const project = allProjects.find((p) => p.id === linkedTask.projectId)
    configure({
      project,
      task: linkedTask,
      minutes: project?.defaultDurationMinutes ?? defaultMinutes
    })
    onClose()
    navigate('/')
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
              className="no-drag w-full resize-none bg-transparent text-lg font-semibold tracking-tight focus:outline-none"
            />
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
              {/* Task link */}
              <div className="rounded-xl border border-border/70 bg-surface/40 p-3.5">
                {linkedTask ? (
                  <>
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <ListChecks className="h-4 w-4 text-primary" /> Tarefa
                      </p>
                      <button
                        onClick={() => patch({ taskId: undefined })}
                        className="no-drag flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Unlink className="h-3 w-3" /> Desvincular
                      </button>
                    </div>
                    <p className="mb-2.5 text-xs text-muted-foreground">
                      {linkedTask.title}
                      {linkedTask.checklist.length > 0 &&
                        ` · ${linkedTask.checklist.filter((c) => c.done).length}/${
                          linkedTask.checklist.length
                        }`}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="primary" onClick={startSession}>
                        <Play className="h-3.5 w-3.5 fill-current" /> Iniciar sessão
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setTaskOpen(true)}>
                        <Maximize2 className="h-3.5 w-3.5" /> Abrir
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                      <Sparkles className="h-4 w-4 text-primary" /> Transformar em tarefa
                    </p>
                    <p className="mb-2.5 text-xs text-muted-foreground">
                      Ganha checklist, prioridade e botão de Iniciar Sessão.
                    </p>
                    {projects.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Crie um projeto primeiro em <strong>Projetos</strong>.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {boardProject ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => void convertToTask(boardProject.id)}
                          >
                            <ArrowRight className="h-3.5 w-3.5" /> Virar tarefa
                          </Button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="primary">
                                <ArrowRight className="h-3.5 w-3.5" /> Virar tarefa
                                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuLabel>Em qual projeto?</DropdownMenuLabel>
                              {projects.map((p) => (
                                <DropdownMenuItem
                                  key={p.id}
                                  onSelect={() => void convertToTask(p.id)}
                                >
                                  <span className="flex items-center gap-2">
                                    <DynamicIcon
                                      name={p.icon}
                                      className="h-4 w-4"
                                      style={{ color: `hsl(${p.color})` }}
                                    />
                                    {p.name}
                                  </span>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <LinkExistingTask
                          tasks={allTasks}
                          onPick={(taskId) => patch({ taskId })}
                        />
                      </div>
                    )}
                  </>
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
                  className="no-drag min-h-[90px] w-full resize-y rounded-xl border border-input bg-surface/60 px-3 py-2 text-xs leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none scrollbar-thin"
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

              {/* Due date */}
              <div>
                <p className="mb-1.5 text-sm font-medium">Prazo</p>
                <DatePicker
                  value={card.dueDate}
                  onChange={(next) => patch({ dueDate: next })}
                />
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

      {taskOpen && linkedTask && (
        <TaskDetailDialog taskId={linkedTask.id} onClose={() => setTaskOpen(false)} />
      )}
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

function LinkExistingTask({
  tasks,
  onPick
}: {
  tasks: Task[]
  onPick: (taskId: string) => void
}): JSX.Element | null {
  const projects = useAppStore((s) => s.projects)
  const open = tasks.filter((t) => t.status !== 'done')
  if (open.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary">
          <Link2 className="h-3.5 w-3.5" /> Vincular
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[18rem] overflow-y-auto">
        <DropdownMenuLabel>Tarefas em aberto</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {open.map((t) => {
          const project = projects.find((p) => p.id === t.projectId)
          return (
            <DropdownMenuItem key={t.id} onSelect={() => onPick(t.id)}>
              <span className="flex flex-col">
                <span className="truncate">{t.title}</span>
                {project && (
                  <span className={cn('truncate text-[11px] text-muted-foreground')}>
                    {project.name}
                  </span>
                )}
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
