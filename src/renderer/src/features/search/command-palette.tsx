import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Ban, CircleCheckBig, KanbanSquare, Plus, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useAppStore } from '@/stores/app-store'
import { useBoardsUiStore } from '@/stores/boards-ui-store'
import { useNavigatorStore } from '@/stores/navigator-store'
import { canOnBoard, isCardCancelled, isCardDone } from '@/features/boards/board-templates'
import { deliveries, dueLabel, isLate, searchable } from '@/features/boards/card-flow'
import { cn, uid } from '@/lib/utils'
import type { Board, BoardCard } from '@shared/types'

type Item =
  | { kind: 'card'; id: string; card: BoardCard; board: Board }
  | { kind: 'board'; id: string; board: Board }
  | { kind: 'create'; id: string; title: string; board: Board }

const MAX_CARDS = 30

/**
 * Ctrl+K from anywhere: find any card on any board by its title and open it,
 * jump to a board, or create a card from what was typed.
 *
 * With nothing typed it lists the coming deliveries, which is most of the
 * time what you were about to look for.
 */
export function CommandPalette(): JSX.Element {
  const open = useNavigatorStore((s) => s.searchOpen)
  const setOpen = useNavigatorStore((s) => s.setSearchOpen)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!useNavigatorStore.getState().searchOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {open && <Palette onDone={() => setOpen(false)} />}
    </Dialog>
  )
}

function Palette({ onDone }: { onDone: () => void }): JSX.Element {
  const navigate = useNavigate()
  const cards = useAppStore((s) => s.cards)
  const boards = useAppStore((s) => s.boards)
  const saveCard = useAppStore((s) => s.saveCard)
  const openCard = useNavigatorStore((s) => s.openCard)
  const lastBoardId = useBoardsUiStore((s) => s.selectedId)
  const selectBoard = useBoardsUiStore((s) => s.select)

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef<HTMLDivElement>(null)

  const items = useMemo<Item[]>(() => {
    const terms = searchable(query).split(/\s+/).filter(Boolean)
    const byId = new Map(boards.map((b) => [b.id, b]))

    if (terms.length === 0) {
      // Today and what's ahead before the overdue, like the home screen.
      const all = deliveries(cards, boards)
      return [...all.filter((d) => d.daysLeft >= 0), ...all.filter((d) => d.daysLeft < 0).reverse()]
        .slice(0, 8)
        .map(({ card, board }) => ({ kind: 'card' as const, id: card.id, card, board }))
    }

    const matches = (text: string): boolean => {
      const hay = searchable(text)
      return terms.every((t) => hay.includes(t))
    }

    // Open work first, then by how soon it is due; a title that starts with
    // what was typed beats one that only contains it.
    const first = searchable(query).trim()
    const found = cards
      .flatMap((card) => {
        const board = byId.get(card.boardId)
        return board && matches(card.title) ? [{ card, board }] : []
      })
      .map(({ card, board }) => ({
        card,
        board,
        closed: isCardDone(card, board.columns) || isCardCancelled(card, board.columns),
        starts: searchable(card.title).startsWith(first)
      }))
      .sort(
        (a, b) =>
          Number(a.closed) - Number(b.closed) ||
          Number(b.starts) - Number(a.starts) ||
          (a.card.dueDate ?? '9999').localeCompare(b.card.dueDate ?? '9999')
      )
      .slice(0, MAX_CARDS)
      .map(({ card, board }) => ({ kind: 'card' as const, id: card.id, card, board }))

    const boardHits = boards
      .filter((b) => matches(b.name))
      .map((board) => ({ kind: 'board' as const, id: `board:${board.id}`, board }))

    // New cards go to the board last opened, if this PC may add cards there.
    const target =
      [byId.get(lastBoardId ?? ''), ...boards].find(
        (b): b is Board => !!b && canOnBoard(b, 'createCards') && b.columns.length > 0
      ) ?? undefined
    const create: Item[] = target
      ? [{ kind: 'create', id: 'create', title: query.trim(), board: target }]
      : []

    return [...found, ...boardHits, ...create]
  }, [query, cards, boards, lastBoardId])

  useEffect(() => setActive(0), [query])

  // Keep the highlighted row in view while moving with the arrows.
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const run = (item: Item | undefined): void => {
    if (!item) return
    onDone()
    if (item.kind === 'card') {
      openCard(item.card.id)
    } else if (item.kind === 'board') {
      selectBoard(item.board.id)
      navigate('/boards')
    } else {
      const column = [...item.board.columns].sort((a, b) => a.order - b.order)[0]
      const stamp = new Date().toISOString()
      const id = uid()
      void saveCard({
        id,
        boardId: item.board.id,
        columnId: column.id,
        title: item.title,
        tags: [],
        assets: [],
        createdAt: stamp,
        updatedAt: stamp,
        order: cards.filter((c) => c.columnId === column.id).length
      }).then(() => openCard(id))
    }
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(items.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(items[active])
    }
  }

  return (
    <DialogContent
      hideClose
      aria-describedby={undefined}
      className="top-[12%] max-w-xl translate-y-0 overflow-hidden p-0"
      onKeyDown={onKeyDown}
    >
      <DialogTitle className="sr-only">Buscar</DialogTitle>
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar card ou quadro…"
          className="no-drag h-12 min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <kbd className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          Esc
        </kbd>
      </div>

      <div ref={list} className="max-h-[55vh] overflow-y-auto p-1.5 scrollbar-thin">
        {!query.trim() && items.length > 0 && (
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">
            Próximas entregas
          </p>
        )}
        {items.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            {query.trim() ? 'Nada encontrado.' : 'Nenhuma entrega nos próximos dias.'}
          </p>
        )}
        {items.map((item, index) => (
          <button
            key={item.id}
            data-index={index}
            onMouseMove={() => setActive(index)}
            onClick={() => run(item)}
            className={cn(
              'no-drag flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left',
              index === active && 'bg-surface-hover'
            )}
          >
            <Row item={item} />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        <span>↑↓ para escolher</span>
        <span>Enter para abrir</span>
        <span className="ml-auto">Ctrl+K abre de qualquer tela</span>
      </div>
    </DialogContent>
  )
}

function Row({ item }: { item: Item }): JSX.Element {
  if (item.kind === 'board') {
    return (
      <>
        <KanbanSquare className="h-4 w-4 shrink-0" style={{ color: `hsl(${item.board.color})` }} />
        <span className="min-w-0 flex-1 truncate text-sm">
          Ir para o quadro <span className="font-medium">{item.board.name}</span>
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </>
    )
  }
  if (item.kind === 'create') {
    const column = [...item.board.columns].sort((a, b) => a.order - b.order)[0]
    return (
      <>
        <Plus className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm">
          Criar <span className="font-medium">“{item.title}”</span>
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {item.board.name} › {column?.name}
        </span>
      </>
    )
  }

  const { card, board } = item
  const column = board.columns.find((c) => c.id === card.columnId)
  const done = isCardDone(card, board.columns)
  const dropped = isCardCancelled(card, board.columns)
  return (
    <>
      <span className="h-7 w-[3px] shrink-0 rounded-full" style={{ background: `hsl(${board.color})` }} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm',
            (done || dropped) && 'text-muted-foreground line-through',
            dropped && 'decoration-destructive/60'
          )}
        >
          {card.title}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {board.name} › {column?.name ?? '—'}
        </p>
      </div>
      {done ? (
        <CircleCheckBig className="h-3.5 w-3.5 shrink-0 text-success" />
      ) : dropped ? (
        <Ban className="h-3.5 w-3.5 shrink-0 text-destructive" />
      ) : (
        card.dueDate && (
          <span
            className={cn(
              'shrink-0 text-[11px] tabular',
              isLate(card) ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {dueLabel(card)}
          </span>
        )
      )}
    </>
  )
}
