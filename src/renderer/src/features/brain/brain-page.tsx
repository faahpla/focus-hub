import { useEffect, useMemo, useState } from 'react'
import {
  Brain,
  Download,
  FileText,
  Inbox,
  Layers,
  List,
  Network,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Tag
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { useBrainUiStore, type BrainFilter } from '@/stores/brain-ui-store'
import { useToastStore } from '@/stores/toast-store'
import { COLUMN_COLORS } from '@/features/boards/board-templates'
import { relativeDayLabel, toDayKey } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { BrainNote, BrainTopic } from '@shared/types'
import { noteMatches, notesFromBoard, snippetOf } from './brain-links'
import { NoteEditor, useCreateNote } from './note-editor'
import { BrainGraph } from './brain-graph'

/**
 * The Brain: notes for insights, theories and ideas, gathered under topics
 * and linked to each other with `[[Título]]`.
 *
 * Three columns, like a mail app: where to look on the left, the notes in the
 * middle, the open note on the right. Captured ideas land in the inbox until
 * they get a topic.
 */
export function BrainPage(): JSX.Element {
  const notes = useAppStore((s) => s.brainNotes)
  const topics = useAppStore((s) => s.brainTopics)
  const { selectedId, filter, search, view, select, setFilter, setSearch, setView } =
    useBrainUiStore()
  const createNote = useCreateNote()

  const sortedTopics = useMemo(() => [...topics].sort((a, b) => a.order - b.order), [topics])

  const counts = useMemo(() => {
    const byTopic = new Map<string, number>()
    for (const n of notes) for (const t of n.topics) byTopic.set(t, (byTopic.get(t) ?? 0) + 1)
    return {
      all: notes.length,
      inbox: notes.filter((n) => n.inbox).length,
      pinned: notes.filter((n) => n.pinned).length,
      loose: notes.filter((n) => n.topics.length === 0).length,
      byTopic
    }
  }, [notes])

  // A search looks through every note, whatever is selected on the left.
  const listed = useMemo(() => {
    const inFilter = (n: BrainNote): boolean => {
      if (search.trim()) return noteMatches(n, search)
      if (filter === 'inbox') return !!n.inbox
      if (filter === 'pinned') return !!n.pinned
      if (filter === 'loose') return n.topics.length === 0
      if (filter.startsWith('topic:')) return n.topics.includes(filter.slice(6))
      return true
    }
    return notes
      .filter(inFilter)
      .sort(
        (a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt.localeCompare(a.updatedAt)
      )
  }, [notes, filter, search])

  const selected = notes.find((n) => n.id === selectedId)

  // A filter whose topic was deleted falls back to everything.
  useEffect(() => {
    if (filter.startsWith('topic:') && !topics.some((t) => `topic:${t.id}` === filter))
      setFilter('all')
  }, [filter, topics, setFilter])

  const newNote = (): void => {
    setView('notes')
    createNote({
      topics: filter.startsWith('topic:') ? [filter.slice(6)] : [],
      inbox: filter === 'inbox' ? true : undefined,
      pinned: filter === 'pinned' ? true : undefined
    })
  }

  // Ctrl+N: a new note, from anywhere on this page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        newNote()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex h-full min-h-0">
      {/* Where to look */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-border/60">
        <div className="flex items-center justify-between px-4 pb-3 pt-6">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Brain className="h-5 w-5 text-primary" /> Brain
          </h1>
          <Button size="sm" variant="primary" onClick={newNote} title="Nova nota (Ctrl+N)">
            <Plus className="h-3.5 w-3.5" /> Nota
          </Button>
        </div>

        {/* The list with the open note, or the map of how notes connect. */}
        <div className="mx-3 mb-3 grid grid-cols-2 gap-1 rounded-lg border border-border/70 bg-surface/50 p-0.5">
          {(
            [
              ['notes', List, 'Notas'],
              ['map', Network, 'Mapa']
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              onClick={() => setView(value)}
              className={cn(
                'no-drag flex h-7 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors',
                view === value
                  ? 'bg-surface-elevated text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
              placeholder="Buscar nas notas…"
              className="no-drag h-8 w-full rounded-lg border border-input bg-surface/60 pl-8 pr-2 text-xs placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
            />
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3 scrollbar-thin">
          <NavItem
            icon={Inbox}
            label="Caixa de entrada"
            count={counts.inbox}
            value="inbox"
            highlight={counts.inbox > 0}
          />
          <NavItem icon={FileText} label="Todas as notas" count={counts.all} value="all" />
          <NavItem icon={Pin} label="Fixadas" count={counts.pinned} value="pinned" />
          <NavItem icon={Layers} label="Sem tópico" count={counts.loose} value="loose" />

          <TopicsHeader />
          {sortedTopics.map((topic) => (
            <TopicItem key={topic.id} topic={topic} count={counts.byTopic.get(topic.id) ?? 0} />
          ))}
          {sortedTopics.length === 0 && (
            <p className="px-2.5 py-1 text-[11px] text-muted-foreground">
              Ex.: um por anime. Crie no + acima ou dentro de uma nota.
            </p>
          )}
        </nav>

        <ImportBoard />
      </aside>

      {view === 'map' ? (
        <main className="min-w-0 flex-1">
          <BrainGraph
            onOpen={(id) => {
              select(id)
              setView('notes')
            }}
          />
        </main>
      ) : (
        <>
          {/* The notes */}
          <section className="flex w-80 shrink-0 flex-col border-r border-border/60">
            <div className="flex items-center justify-between px-4 pb-2 pt-6">
              <p className="text-xs font-medium text-muted-foreground">
                {search.trim() ? `Busca: “${search.trim()}”` : filterLabel(filter, topics)}
              </p>
              <span className="text-[11px] tabular text-muted-foreground">{listed.length}</span>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-4 scrollbar-thin">
              {listed.length === 0 ? (
                <div className="px-3 py-10 text-center text-xs text-muted-foreground">
                  {search.trim()
                    ? 'Nenhuma nota com isso.'
                    : filter === 'inbox'
                      ? 'Caixa de entrada vazia. Ideias capturadas com Ctrl+Shift+Espaço chegam aqui.'
                      : 'Nenhuma nota aqui ainda.'}
                </div>
              ) : (
                listed.map((note) => (
                  <NoteRow
                    key={note.id}
                    note={note}
                    topics={topics}
                    active={note.id === selectedId}
                    onClick={() => select(note.id)}
                  />
                ))
              )}
            </div>
          </section>

          {/* The open note */}
          <main className="min-w-0 flex-1">
            {selected ? (
              <NoteEditor key={selected.id} note={selected} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
                <Brain className="h-10 w-10 text-primary/60" />
                <p className="text-sm text-muted-foreground">
                  Escolha uma nota, ou crie uma nova com{' '}
                  <kbd className="rounded border border-border px-1 text-[11px]">Ctrl N</kbd>.
                </p>
                <p className="max-w-sm text-xs text-muted-foreground/80">
                  Dentro de uma nota, digite <span className="font-medium text-foreground">[[</span>{' '}
                  para ligá-la a outra. As ligações aparecem nas duas pontas.
                </p>
              </div>
            )}
          </main>
        </>
      )}
    </div>
  )
}

function filterLabel(filter: BrainFilter, topics: BrainTopic[]): string {
  if (filter === 'inbox') return 'Caixa de entrada'
  if (filter === 'pinned') return 'Fixadas'
  if (filter === 'loose') return 'Sem tópico'
  if (filter.startsWith('topic:'))
    return topics.find((t) => t.id === filter.slice(6))?.name ?? 'Tópico'
  return 'Todas as notas'
}

function NavItem({
  icon: Icon,
  label,
  count,
  value,
  highlight
}: {
  icon: typeof Inbox
  label: string
  count: number
  value: BrainFilter
  highlight?: boolean
}): JSX.Element {
  const { filter, search, setFilter, setSearch } = useBrainUiStore()
  const active = filter === value && !search.trim()
  return (
    <button
      onClick={() => {
        setFilter(value)
        setSearch('')
      }}
      className={cn(
        'no-drag flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
        active
          ? 'bg-surface-elevated text-foreground'
          : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span
        className={cn(
          'text-[11px] tabular',
          highlight
            ? 'rounded-md bg-warning/15 px-1.5 font-semibold text-warning'
            : 'text-muted-foreground'
        )}
      >
        {count}
      </span>
    </button>
  )
}

function TopicsHeader(): JSX.Element {
  const topics = useAppStore((s) => s.brainTopics)
  const saveBrainTopics = useAppStore((s) => s.saveBrainTopics)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const add = (): void => {
    const name = draft.trim()
    if (name) {
      void saveBrainTopics([
        ...topics,
        {
          id: crypto.randomUUID(),
          name,
          color: COLUMN_COLORS[topics.length % COLUMN_COLORS.length],
          order: topics.length
        }
      ])
    }
    setDraft('')
    setAdding(false)
  }

  return (
    <div className="pt-4">
      <div className="flex items-center justify-between px-2.5 pb-1">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <Tag className="h-3 w-3" /> Tópicos
        </span>
        <button
          onClick={() => setAdding(true)}
          title="Novo tópico"
          className="no-drag rounded p-0.5 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {adding && (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
            if (e.key === 'Escape') {
              setDraft('')
              setAdding(false)
            }
          }}
          placeholder="Nome do tópico…"
          className="no-drag mx-1 mb-1 h-7 w-[calc(100%-0.5rem)] rounded-md border border-primary/50 bg-surface-elevated px-2 text-xs focus:outline-none"
        />
      )}
    </div>
  )
}

function TopicItem({ topic, count }: { topic: BrainTopic; count: number }): JSX.Element {
  const topics = useAppStore((s) => s.brainTopics)
  const saveBrainTopics = useAppStore((s) => s.saveBrainTopics)
  const { filter, search, setFilter, setSearch } = useBrainUiStore()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(topic.name)
  const [confirming, setConfirming] = useState(false)
  const value: BrainFilter = `topic:${topic.id}`
  const active = filter === value && !search.trim()

  const patch = (p: Partial<BrainTopic>): void =>
    void saveBrainTopics(topics.map((t) => (t.id === topic.id ? { ...t, ...p } : t)))

  if (renaming) {
    const commit = (): void => {
      const name = draft.trim()
      if (name && name !== topic.name) patch({ name })
      setRenaming(false)
    }
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setRenaming(false)
        }}
        className="no-drag mx-1 h-7 w-[calc(100%-0.5rem)] rounded-md border border-primary/50 bg-surface-elevated px-2 text-xs focus:outline-none"
      />
    )
  }

  return (
    <div
      className={cn(
        'group flex items-center rounded-lg transition-colors',
        active ? 'bg-surface-elevated' : 'hover:bg-surface-hover'
      )}
    >
      <button
        onClick={() => {
          setFilter(value)
          setSearch('')
        }}
        onDoubleClick={() => {
          setDraft(topic.name)
          setRenaming(true)
        }}
        className={cn(
          'no-drag flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left text-sm',
          active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
        )}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: `hsl(${topic.color})` }}
        />
        <span className="min-w-0 flex-1 truncate">{topic.name}</span>
        <span className="text-[11px] tabular text-muted-foreground">{count}</span>
      </button>
      <DropdownMenu onOpenChange={(open) => !open && setConfirming(false)}>
        <DropdownMenuTrigger asChild>
          <button className="no-drag mr-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onSelect={() => {
              setDraft(topic.name)
              setRenaming(true)
            }}
          >
            Renomear
          </DropdownMenuItem>
          <div className="grid grid-cols-7 gap-1.5 px-2.5 py-2">
            {COLUMN_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => patch({ color })}
                className={cn(
                  'h-4 w-4 rounded-full transition-transform hover:scale-110',
                  topic.color === color &&
                    'ring-2 ring-foreground/70 ring-offset-2 ring-offset-surface-elevated'
                )}
                style={{ backgroundColor: `hsl(${color})` }}
                aria-label={`Cor ${color}`}
              />
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              if (!confirming) {
                e.preventDefault()
                setConfirming(true)
                return
              }
              void saveBrainTopics(topics.filter((t) => t.id !== topic.id))
            }}
            className="text-destructive data-[highlighted]:bg-destructive/10"
          >
            {confirming ? 'Confirmar: excluir tópico' : 'Excluir tópico (as notas ficam)'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function NoteRow({
  note,
  topics,
  active,
  onClick
}: {
  note: BrainNote
  topics: BrainTopic[]
  active: boolean
  onClick: () => void
}): JSX.Element {
  const dots = note.topics
    .map((id) => topics.find((t) => t.id === id))
    .filter((t): t is BrainTopic => !!t)
  const snippet = snippetOf(note.body)
  return (
    <button
      onClick={onClick}
      className={cn(
        'no-drag block w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
        active
          ? 'border-primary/40 bg-primary/10'
          : 'border-transparent hover:border-border/70 hover:bg-surface-hover'
      )}
    >
      <div className="flex items-center gap-1.5">
        {note.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
        {note.inbox && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
            title="Na caixa de entrada"
          />
        )}
        <p
          className={cn(
            'min-w-0 flex-1 truncate text-sm font-medium',
            !note.title && 'italic text-muted-foreground'
          )}
        >
          {note.title || 'Sem título'}
        </p>
      </div>
      {snippet && (
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {snippet}
        </p>
      )}
      <div className="mt-1.5 flex items-center gap-1.5">
        {dots.slice(0, 3).map((t) => (
          <span
            key={t.id}
            className="truncate rounded px-1.5 text-[10px] font-medium"
            style={{ background: `hsl(${t.color} / 0.15)`, color: `hsl(${t.color})` }}
          >
            {t.name}
          </span>
        ))}
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
          {relativeDayLabel(toDayKey(new Date(note.updatedAt)))}
        </span>
      </div>
    </button>
  )
}

/**
 * Bring a board used as a brain — the one called BRAIN — into notes. Shows
 * only while it has cards not brought in yet; the board itself is untouched.
 */
function ImportBoard(): JSX.Element | null {
  const boards = useAppStore((s) => s.boards)
  const cards = useAppStore((s) => s.cards)
  const notes = useAppStore((s) => s.brainNotes)
  const topics = useAppStore((s) => s.brainTopics)
  const saveBrainNotes = useAppStore((s) => s.saveBrainNotes)
  const saveBrainTopics = useAppStore((s) => s.saveBrainTopics)
  const push = useToastStore((s) => s.push)
  const [busy, setBusy] = useState(false)

  const pending = useMemo(() => {
    const brought = new Set(notes.map((n) => n.fromCardId).filter(Boolean))
    return boards
      .filter((b) => /^brain$/i.test(b.name.trim()))
      .map((board) => ({
        board,
        count: cards.filter((c) => c.boardId === board.id && !brought.has(c.id)).length
      }))
      .filter((p) => p.count > 0)
  }, [boards, cards, notes])

  if (pending.length === 0) return null
  const { board, count } = pending[0]

  const run = async (): Promise<void> => {
    setBusy(true)
    const result = notesFromBoard(board, cards, notes, topics)
    await saveBrainTopics(result.topics)
    await saveBrainNotes(result.notes)
    setBusy(false)
    push({
      title: `${result.notes.length} notas trazidas do quadro ${board.name}`,
      lines: [
        `${result.topics.length - topics.length} tópicos novos, um por coluna.`,
        'O quadro continua lá, intacto.'
      ],
      variant: 'success',
      duration: 8000
    })
  }

  return (
    <div className="m-3 rounded-xl border border-primary/30 bg-primary/[0.07] p-3">
      <p className="text-xs font-medium">Quadro {board.name}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {count} cards para virar notas. Cada coluna vira um tópico; o quadro fica como está.
      </p>
      <Button
        size="sm"
        variant="primary"
        className="mt-2 w-full"
        onClick={() => void run()}
        disabled={busy}
      >
        <Download className="h-3.5 w-3.5" /> {busy ? 'Trazendo…' : `Trazer ${count} cards`}
      </Button>
    </div>
  )
}
