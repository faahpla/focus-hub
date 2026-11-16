import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  CornerDownLeft,
  FileText,
  Inbox,
  KanbanSquare,
  Link2,
  Pin,
  Plus,
  Trash2,
  X
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/rich-text-editor'
import type { WikiLinkSource } from '@/components/wiki-links'
import { ExportTextButton } from '@/components/export-text-button'
import { useAppStore } from '@/stores/app-store'
import { useNavigatorStore } from '@/stores/navigator-store'
import { useBrainUiStore } from '@/stores/brain-ui-store'
import { useAutosavedText } from '@/hooks/use-autosave'
import { COLUMN_COLORS } from '@/features/boards/board-templates'
import { searchable } from '@/features/boards/card-flow'
import { cn, uid } from '@/lib/utils'
import type { BrainNote, BrainTopic } from '@shared/types'
import { backlinksOf, linksIn, notesByTitle, renameLinks, snippetOf, titleKey } from './brain-links'
import { ToCardDialog } from './to-card-dialog'

/** Save part of a note, on top of its freshest copy in the store. */
function useUpdateNote(): (id: string, patch: Partial<BrainNote>) => void {
  const saveBrainNotes = useAppStore((s) => s.saveBrainNotes)
  return (id, patch) => {
    const fresh = useAppStore.getState().brainNotes.find((n) => n.id === id)
    if (fresh) void saveBrainNotes([{ ...fresh, ...patch, updatedAt: new Date().toISOString() }])
  }
}

/** A new, empty note — under the given topics — saved and opened. */
export function useCreateNote(): (init?: Partial<BrainNote>) => string {
  const saveBrainNotes = useAppStore((s) => s.saveBrainNotes)
  const select = useBrainUiStore((s) => s.select)
  return (init = {}) => {
    const stamp = new Date().toISOString()
    const note: BrainNote = {
      id: uid(),
      title: '',
      body: '',
      topics: [],
      createdAt: stamp,
      updatedAt: stamp,
      ...init
    }
    void saveBrainNotes([note])
    select(note.id)
    return note.id
  }
}

export function NoteEditor({ note }: { note: BrainNote }): JSX.Element {
  const notes = useAppStore((s) => s.brainNotes)
  const topics = useAppStore((s) => s.brainTopics)
  const cards = useAppStore((s) => s.cards)
  const boards = useAppStore((s) => s.boards)
  const saveBrainNotes = useAppStore((s) => s.saveBrainNotes)
  const deleteBrainNote = useAppStore((s) => s.deleteBrainNote)
  const select = useBrainUiStore((s) => s.select)
  const openCard = useNavigatorStore((s) => s.openCard)
  const update = useUpdateNote()
  const createNote = useCreateNote()

  const [toCard, setToCard] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // ---- Title ----------------------------------------------------------------
  /*
    Committed on Enter, on leaving the field and on switching notes — never
    while typing. Renaming rewrites the links that point here, and doing that
    on every keystroke would drag them through every half-typed title, some of
    which could be another note's name.
  */
  const [title, setTitle] = useState(note.title)
  const titleRef = useRef(title)
  titleRef.current = title
  useEffect(() => setTitle(note.title), [note.title])

  const commitTitle = (): void => {
    const all = useAppStore.getState().brainNotes
    const fresh = all.find((n) => n.id === note.id)
    const next = titleRef.current.trim()
    if (!fresh || next === fresh.title) return
    const stamp = new Date().toISOString()
    const changed: BrainNote[] = [{ ...fresh, title: next, updatedAt: stamp }]
    // Links follow the rename — unless another note shares the old title, in
    // which case they may mean that one and are left alone.
    const oldKey = titleKey(fresh.title)
    const shared = all.some((n) => n.id !== fresh.id && titleKey(n.title) === oldKey)
    if (oldKey && next && !shared) {
      for (const other of all) {
        if (other.id === fresh.id) continue
        const body = renameLinks(other.body, fresh.title, next)
        if (body !== other.body) changed.push({ ...other, body, updatedAt: stamp })
      }
    }
    void saveBrainNotes(changed)
  }
  // Leaving the note with an uncommitted title still saves it.
  const commitRef = useRef(commitTitle)
  commitRef.current = commitTitle
  useEffect(() => () => commitRef.current(), [])

  // ---- Body -----------------------------------------------------------------
  const [body, setBody] = useAutosavedText(note.body, (next) => update(note.id, { body: next }))

  // ---- Links ----------------------------------------------------------------
  const byTitle = useMemo(() => notesByTitle(notes), [notes])
  const titlesVersion = useMemo(() => notes.map((n) => n.title).join('\n'), [notes])
  const links = useMemo<WikiLinkSource>(
    () => ({
      exists: (t) => byTitle.has(titleKey(t)),
      open: (t) => {
        const target = byTitle.get(titleKey(t))
        if (target) select(target.id)
        // A link to a note that doesn't exist yet creates it, under the same topics.
        else createNote({ title: t.trim(), topics: note.topics })
      },
      suggest: (query) => {
        const q = searchable(query.trim())
        return notes
          .filter((n) => n.id !== note.id && n.title.trim() && searchable(n.title).includes(q))
          .sort(
            (a, b) =>
              Number(searchable(b.title).startsWith(q)) - Number(searchable(a.title).startsWith(q)) ||
              b.updatedAt.localeCompare(a.updatedAt)
          )
          .map((n) => n.title)
      },
      version: titlesVersion
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [byTitle, titlesVersion, note.id, note.topics]
  )
  const backlinks = useMemo(() => backlinksOf(note, notes), [note, notes])
  const outgoing = useMemo(() => linksIn(body), [body])

  // ---- Topics ---------------------------------------------------------------
  const noteTopics = note.topics
    .map((id) => topics.find((t) => t.id === id))
    .filter((t): t is BrainTopic => !!t)

  const toggleTopic = (id: string): void => {
    const has = note.topics.includes(id)
    // Giving a note a topic is sorting it: it leaves the inbox.
    update(note.id, {
      topics: has ? note.topics.filter((t) => t !== id) : [...note.topics, id],
      ...(has ? {} : { inbox: false })
    })
  }

  // ---- The card it became -----------------------------------------------------
  const card = note.cardId ? cards.find((c) => c.id === note.cardId) : undefined
  const cardBoard = card ? boards.find((b) => b.id === card.boardId) : undefined
  const cardColumn = card && cardBoard ? cardBoard.columns.find((c) => c.id === card.columnId) : undefined

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border/70 px-8 pb-3 pt-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
          autoFocus={!note.title}
          placeholder="Sem título"
          className="no-drag w-full bg-transparent text-2xl font-semibold tracking-tight placeholder:text-muted-foreground/50 focus:outline-none"
        />

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {note.inbox && (
            <button
              onClick={() => update(note.id, { inbox: false })}
              title="Tirar da caixa de entrada"
              className="no-drag flex items-center gap-1 rounded-lg border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] text-warning transition-colors hover:bg-warning/20"
            >
              <Inbox className="h-3 w-3" /> Caixa de entrada · marcar como organizada
            </button>
          )}
          {noteTopics.map((topic) => (
            <span
              key={topic.id}
              className="group flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium"
              style={{ background: `hsl(${topic.color} / 0.15)`, color: `hsl(${topic.color})` }}
            >
              {topic.name}
              <button
                onClick={() => toggleTopic(topic.id)}
                className="no-drag opacity-50 transition-opacity hover:opacity-100"
                aria-label={`Tirar do tópico ${topic.name}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <TopicPicker selected={note.topics} onToggle={toggleTopic} />

          <div className="ml-auto flex items-center gap-1">
            <ExportTextButton folder="Brain" name={note.title || 'Sem título'} value={body} />
            <button
              onClick={() => update(note.id, { pinned: !note.pinned })}
              title={note.pinned ? 'Desafixar' : 'Fixar no topo da lista'}
              className={cn(
                'no-drag flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                note.pinned
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              )}
            >
              <Pin className="h-3.5 w-3.5" />
            </button>
            {card ? (
              <Button size="sm" variant="secondary" onClick={() => openCard(card.id)}>
                <KanbanSquare className="h-3.5 w-3.5" style={{ color: `hsl(${cardBoard?.color})` }} />
                {cardBoard?.name} › {cardColumn?.name ?? '—'}
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setToCard(true)}>
                <KanbanSquare className="h-3.5 w-3.5" /> Virar card
              </Button>
            )}
            {confirmingDelete ? (
              <span className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">Excluir nota?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    void deleteBrainNote(note.id)
                    select(null)
                  }}
                >
                  Excluir
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                  Não
                </Button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                title="Excluir nota"
                className="no-drag flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body and links */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <RichTextEditor
          key={note.id}
          value={body}
          onChange={setBody}
          links={links}
          placeholder="Escreva o insight… Digite [[ para ligar a outra nota."
          className="min-h-[50%] px-8 py-5 text-[15px] leading-relaxed"
          contentClassName="max-w-3xl"
        />

        {(backlinks.length > 0 || outgoing.length > 0) && (
          <div className="mx-8 mb-10 max-w-3xl space-y-4 border-t border-border/60 pt-5">
            {backlinks.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <CornerDownLeft className="h-3.5 w-3.5" /> Mencionada em ({backlinks.length})
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {backlinks.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => select(n.id)}
                      className="no-drag rounded-xl border border-border/70 bg-surface/40 px-3 py-2 text-left transition-colors hover:bg-surface-hover"
                    >
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {n.title || 'Sem título'}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {snippetOf(n.body, 120) || 'Sem texto'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {outgoing.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5" /> Liga para
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {outgoing.map((t) => {
                    const exists = byTitle.has(titleKey(t))
                    return (
                      <button
                        key={t}
                        onClick={() => links.open(t)}
                        title={exists ? 'Abrir' : 'Essa nota ainda não existe — clique para criar'}
                        className={cn(
                          'no-drag flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs transition-colors',
                          exists
                            ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
                            : 'border-dashed border-border text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {!exists && <Plus className="h-3 w-3" />}
                        {t}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {toCard && <ToCardDialog note={note} onClose={() => setToCard(false)} />}
    </div>
  )
}

/** "+ Tópico": tick the note's topics, or create one by typing its name. */
function TopicPicker({
  selected,
  onToggle
}: {
  selected: string[]
  onToggle: (id: string) => void
}): JSX.Element {
  const topics = useAppStore((s) => s.brainTopics)
  const saveBrainTopics = useAppStore((s) => s.saveBrainTopics)
  const [draft, setDraft] = useState('')

  const create = async (): Promise<void> => {
    const name = draft.trim()
    if (!name) return
    const existing = topics.find((t) => titleKey(t.name) === titleKey(name))
    if (existing) {
      if (!selected.includes(existing.id)) onToggle(existing.id)
    } else {
      const topic: BrainTopic = {
        id: uid(),
        name,
        color: COLUMN_COLORS[topics.length % COLUMN_COLORS.length],
        order: topics.length
      }
      await saveBrainTopics([...topics, topic])
      onToggle(topic.id)
    }
    setDraft('')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="no-drag flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
          <Plus className="h-3 w-3" /> Tópico
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
        <div className="p-1.5" onKeyDown={(e) => e.stopPropagation()}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void create()
              }
            }}
            placeholder="Novo tópico e Enter…"
            className="no-drag h-7 w-full rounded-md border border-input bg-surface/60 px-2 text-xs placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
          />
        </div>
        {topics.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Tópicos</DropdownMenuLabel>
          </>
        )}
        {[...topics]
          .sort((a, b) => a.order - b.order)
          .map((topic) => (
            <DropdownMenuItem
              key={topic.id}
              onSelect={(e) => {
                e.preventDefault()
                onToggle(topic.id)
              }}
            >
              <span className="flex w-full items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: `hsl(${topic.color})` }} />
                <span className="min-w-0 flex-1 truncate">{topic.name}</span>
                {selected.includes(topic.id) && <Check className="h-3.5 w-3.5 text-primary" />}
              </span>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
