import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarDays,
  Check,
  CircleCheckBig,
  ListChecks,
  MoreHorizontal,
  Paperclip,
  Plus,
  X
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/stores/app-store'
import type { Board, BoardCard, BoardColumn, Task } from '@shared/types'
import { COLUMN_COLORS, isCardDone, makeColumn } from './board-templates'
import { CardDetailDialog } from './card-detail-dialog'
import { CardContextMenu, type ContextTarget } from './card-context-menu'
import { cn, uid } from '@/lib/utils'

type Lanes = Record<string, string[]>

/** Group card ids by column, ordered. Cards whose column vanished go to the first one. */
function buildLanes(columns: BoardColumn[], cards: BoardCard[]): Lanes {
  const lanes: Lanes = {}
  for (const col of columns) lanes[col.id] = []
  const fallback = columns[0]?.id
  for (const card of [...cards].sort((a, b) => a.order - b.order)) {
    const lane = lanes[card.columnId] ? card.columnId : fallback
    if (lane) lanes[lane].push(card.id)
  }
  return lanes
}

/**
 * Follow the actual pointer instead of the dragged card's rect. With rect-based
 * detection the card's own box decides the target, so you had to overshoot into
 * the lower half of a column for the drop to register. Falls back to rect
 * intersection when the pointer is between droppables.
 */
const collisionDetection: CollisionDetection = (args) => {
  const byPointer = pointerWithin(args)
  if (byPointer.length > 0) return byPointer
  const byRect = rectIntersection(args)
  if (byRect.length > 0) return byRect
  return closestCorners(args)
}

export function BoardView({ board }: { board: Board }): JSX.Element {
  const [contextTarget, setContextTarget] = useState<ContextTarget | null>(null)
  const allCards = useAppStore((s) => s.cards)
  const tasks = useAppStore((s) => s.tasks)
  const saveCard = useAppStore((s) => s.saveCard)
  const saveCards = useAppStore((s) => s.saveCards)
  const saveBoard = useAppStore((s) => s.saveBoard)

  const cards = useMemo(
    () => allCards.filter((c) => c.boardId === board.id),
    [allCards, board.id]
  )
  const columns = useMemo(
    () => [...board.columns].sort((a, b) => a.order - b.order),
    [board.columns]
  )

  const [lanes, setLanes] = useState<Lanes>(() => buildLanes(columns, cards))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const dragging = useRef(false)

  // Re-sync from the store, but never while a drag is in flight (that would
  // yank the card out from under the pointer).
  useEffect(() => {
    if (dragging.current) return
    const next = buildLanes(columns, cards)
    setLanes((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  }, [columns, cards])

  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  /** Tasks grouped by the card they help deliver — a card owns many now. */
  const tasksByCard = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      if (!task.cardId) continue
      const list = map.get(task.cardId) ?? []
      list.push(task)
      map.set(task.cardId, list)
    }
    return map
  }, [tasks])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const laneOf = (id: string, source: Lanes): string | undefined =>
    source[id] ? id : Object.keys(source).find((k) => source[k].includes(id))

  /** Write back every card whose column or position actually changed. */
  const persist = (next: Lanes): void => {
    const changed: BoardCard[] = []
    for (const [columnId, ids] of Object.entries(next)) {
      ids.forEach((id, order) => {
        const card = cardsById.get(id)
        if (card && (card.columnId !== columnId || card.order !== order)) {
          /*
            Only hand the "done" state back to the column when the card lands
            in a column that decides it. Clearing the flag on *every* move
            threw away a tick the user had just made by hand: marking a card
            done and then dragging it to Publicados un-marked it.

            A card whose done-ness came from its old column has no flag to
            begin with, so dragging it back out still un-finishes it.
          */
          const moved = card.columnId !== columnId
          const landsInDoneColumn = columns.find((c) => c.id === columnId)?.done === true
          changed.push({
            ...card,
            columnId,
            order,
            ...(moved && landsInDoneColumn ? { done: undefined } : {})
          })
        }
      })
    }
    if (changed.length) void saveCards(changed)
  }

  const onDragStart = (e: DragStartEvent): void => {
    dragging.current = true
    setActiveId(e.active.id as string)
  }

  const onDragOver = (e: DragOverEvent): void => {
    const { active, over } = e
    if (!over) return
    const activeCardId = active.id as string
    const overId = over.id as string

    // Drop above or below the hovered card depending on which half we're on.
    const activeTop = active.rect.current.translated?.top
    const dropsBelow =
      activeTop !== undefined && activeTop > over.rect.top + over.rect.height / 2

    setLanes((prev) => {
      const from = laneOf(activeCardId, prev)
      const to = laneOf(overId, prev)
      if (!from || !to || from === to) return prev
      const src = prev[from].filter((id) => id !== activeCardId)
      const dst = [...prev[to]]
      const overIdx = dst.indexOf(overId)
      const insertAt = overIdx >= 0 ? overIdx + (dropsBelow ? 1 : 0) : dst.length
      dst.splice(insertAt, 0, activeCardId)
      return { ...prev, [from]: src, [to]: dst }
    })
  }

  const onDragEnd = (e: DragEndEvent): void => {
    dragging.current = false
    setActiveId(null)
    const { active, over } = e
    const activeCardId = active.id as string

    let final = lanes
    if (over) {
      const from = laneOf(activeCardId, lanes)
      const to = laneOf(over.id as string, lanes)
      if (from && to && from === to) {
        const oldIndex = lanes[from].indexOf(activeCardId)
        const newIndex = lanes[to].indexOf(over.id as string)
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          final = { ...lanes, [from]: arrayMove(lanes[from], oldIndex, newIndex) }
          setLanes(final)
        }
      }
    }
    persist(final)
  }

  const onDragCancel = (): void => {
    dragging.current = false
    setActiveId(null)
    setLanes(buildLanes(columns, cards))
  }

  const addCard = (columnId: string, title: string): void => {
    const stamp = new Date().toISOString()
    void saveCard({
      id: uid(),
      boardId: board.id,
      columnId,
      title,
      tags: [],
      assets: [],
      createdAt: stamp,
      updatedAt: stamp,
      order: (lanes[columnId]?.length ?? 0)
    })
  }

  const patchColumn = (columnId: string, patch: Partial<BoardColumn>): void => {
    void saveBoard({
      ...board,
      columns: board.columns.map((c) => (c.id === columnId ? { ...c, ...patch } : c))
    })
  }

  const toggleCardDone = (cardId: string): void => {
    const card = cardsById.get(cardId)
    if (!card) return
    void saveCard({ ...card, done: !isCardDone(card, columns) })
  }

  const addColumn = (): void => {
    void saveBoard({
      ...board,
      columns: [...board.columns, makeColumn('Nova coluna', board.columns.length)]
    })
  }

  const removeColumn = (columnId: string): void => {
    const remaining = columns.filter((c) => c.id !== columnId)
    if (!remaining.length) return
    // Never destroy cards — relocate them to the first remaining column.
    const orphans = cards.filter((c) => c.columnId === columnId)
    if (orphans.length) {
      const target = remaining[0].id
      const base = lanes[target]?.length ?? 0
      void saveCards(
        orphans.map((c, i) => ({ ...c, columnId: target, order: base + i }))
      )
    }
    void saveBoard({
      ...board,
      columns: remaining.map((c, i) => ({ ...c, order: i }))
    })
  }

  const activeCard = activeId ? cardsById.get(activeId) : undefined

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="flex h-full gap-4 overflow-x-auto px-8 pb-6 scrollbar-thin">
          {columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              cardIds={lanes[column.id] ?? []}
              cardsById={cardsById}
              tasksByCard={tasksByCard}
              canDelete={columns.length > 1}
              onAddCard={(title) => addCard(column.id, title)}
              onRename={(name) => patchColumn(column.id, { name })}
              onRecolor={(color) => patchColumn(column.id, { color })}
              onToggleDone={() => patchColumn(column.id, { done: !column.done })}
              onDelete={() => removeColumn(column.id)}
              onOpenCard={setOpenCardId}
              onToggleCardDone={toggleCardDone}
              onCardContextMenu={setContextTarget}
              columns={columns}
            />
          ))}

          <button
            onClick={addColumn}
            className="no-drag flex h-11 w-[280px] shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-surface-hover hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Nova coluna
          </button>
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2,0,0,1)' }}>
          {activeCard && (
            <div className="w-[264px] rotate-2">
              <CardBody
                card={activeCard}
                tasks={tasksByCard.get(activeCard.id) ?? []}
                done={isCardDone(activeCard, columns)}
                dragging
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {contextTarget && (
        <CardContextMenu
          target={contextTarget}
          board={board}
          onClose={() => setContextTarget(null)}
          onOpenCard={setOpenCardId}
        />
      )}

      {openCardId && (
        <CardDetailDialog
          // Remount per card so the autosaved fields reseed from the new card.
          key={openCardId}
          cardId={openCardId}
          board={board}
          onClose={() => setOpenCardId(null)}
        />
      )}
    </>
  )
}

function Column({
  column,
  cardIds,
  cardsById,
  tasksByCard,
  canDelete,
  onAddCard,
  onRename,
  onRecolor,
  onToggleDone,
  onDelete,
  onOpenCard,
  onToggleCardDone,
  onCardContextMenu,
  columns
}: {
  column: BoardColumn
  cardIds: string[]
  cardsById: Map<string, BoardCard>
  tasksByCard: Map<string, Task[]>
  canDelete: boolean
  onAddCard: (title: string) => void
  onRename: (name: string) => void
  onRecolor: (color: string) => void
  onToggleDone: () => void
  onDelete: () => void
  onOpenCard: (id: string) => void
  onToggleCardDone: (id: string) => void
  onCardContextMenu: (target: ContextTarget) => void
  columns: BoardColumn[]
}): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(column.name)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const commitRename = (): void => {
    const name = draft.trim()
    if (name && name !== column.name) onRename(name)
    else setDraft(column.name)
    setRenaming(false)
  }

  const commitAdd = (): void => {
    const title = newTitle.trim()
    if (title) onAddCard(title)
    setNewTitle('')
    // Stay open so several cards can be dumped in a row — the ADHD-friendly path.
  }

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2 px-1">
        {column.done ? (
          <CircleCheckBig className="h-3.5 w-3.5 shrink-0 text-success" />
        ) : (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: `hsl(${column.color})` }}
          />
        )}
        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                setDraft(column.name)
                setRenaming(false)
              }
            }}
            className="no-drag min-w-0 flex-1 rounded-md bg-surface-elevated px-1.5 py-0.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary/60"
          />
        ) : (
          <button
            onDoubleClick={() => {
              setDraft(column.name)
              setRenaming(true)
            }}
            className={cn(
              'no-drag min-w-0 flex-1 truncate text-left text-sm font-semibold',
              column.done && 'text-success'
            )}
            title="Duplo clique para renomear"
          >
            {column.name}
          </button>
        )}
        <span className="shrink-0 rounded-md bg-surface-elevated px-1.5 py-0.5 text-[11px] tabular text-muted-foreground">
          {cardIds.length}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="no-drag flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                setDraft(column.name)
                setRenaming(true)
              }}
            >
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onToggleDone} active={column.done === true}>
              <span className="flex items-center gap-2">
                <CircleCheckBig className="h-4 w-4" />
                Coluna de conclusão
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="flex gap-1.5 px-2.5 py-2">
              {COLUMN_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onRecolor(color)}
                  className={cn(
                    'h-5 w-5 rounded-full transition-transform hover:scale-110',
                    column.color === color && 'ring-2 ring-foreground/70 ring-offset-2 ring-offset-surface-elevated'
                  )}
                  style={{ backgroundColor: `hsl(${color})` }}
                  aria-label={`Cor ${color}`}
                />
              ))}
            </div>
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={onDelete}
                  className="text-destructive data-[highlighted]:bg-destructive/10"
                >
                  Excluir coluna
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border border-transparent p-1.5 transition-colors scrollbar-thin',
          column.done && 'border-success/20 bg-success/[0.04]',
          isOver && 'border-primary/40 bg-primary/5'
        )}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {cardIds.map((id) => {
              const card = cardsById.get(id)
              if (!card) return null
              return (
                <SortableCard
                  key={id}
                  card={card}
                  tasks={tasksByCard.get(card.id) ?? []}
                  done={isCardDone(card, columns)}
                  onOpen={() => onOpenCard(id)}
                  onToggleDone={() => onToggleCardDone(id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    onCardContextMenu({ cardId: id, x: e.clientX, y: e.clientY })
                  }}
                />
              )
            })}
          </AnimatePresence>
        </SortableContext>

        {cardIds.length === 0 && !adding && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/50 py-8 text-center text-xs text-muted-foreground">
            Solte um card aqui
          </div>
        )}

        {/* Add card */}
        {adding ? (
          <div className="rounded-xl border border-primary/40 bg-surface/80 p-2">
            <textarea
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  commitAdd()
                }
                if (e.key === 'Escape') {
                  setNewTitle('')
                  setAdding(false)
                }
              }}
              placeholder="Título do card…"
              rows={2}
              className="no-drag w-full resize-none bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none"
            />
            <div className="mt-1 flex items-center gap-1.5">
              <button
                onClick={commitAdd}
                className="no-drag flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground"
              >
                <Check className="h-3.5 w-3.5" /> Adicionar
              </button>
              <button
                onClick={() => {
                  setNewTitle('')
                  setAdding(false)
                }}
                className="no-drag flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="no-drag flex h-8 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar card
          </button>
        )}
      </div>
    </div>
  )
}

function SortableCard({
  card,
  tasks,
  done,
  onOpen,
  onToggleDone,
  onContextMenu
}: {
  card: BoardCard
  tasks: Task[]
  done: boolean
  onOpen: () => void
  onToggleDone: () => void
  onContextMenu: (e: React.MouseEvent) => void
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onContextMenu={onContextMenu}
      className={cn('no-drag touch-none', isDragging && 'opacity-30')}
    >
      <CardBody card={card} tasks={tasks} done={done} onToggleDone={onToggleDone} />
    </div>
  )
}

/** The visual card. Shared by the list and the drag overlay. */
function CardBody({
  card,
  tasks,
  done,
  dragging,
  onToggleDone
}: {
  card: BoardCard
  tasks: Task[]
  done?: boolean
  dragging?: boolean
  onToggleDone?: () => void
}): JSX.Element {
  const doneTasks = tasks.filter((t) => t.status === 'done').length
  const assetCount = card.assets?.length ?? 0
  // A card is finished by its column or by hand — never by its tasks, since a
  // deliverable can have every step done and still be waiting to publish.
  const finished = done ?? false

  return (
    <motion.div
      layout={!dragging}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'group/card relative cursor-grab select-none rounded-xl border border-border/70 bg-surface/70 p-3 transition-colors hover:border-border hover:bg-surface-hover active:cursor-grabbing',
        finished && 'border-success/25 bg-success/[0.06] opacity-70 hover:opacity-100',
        dragging && 'border-primary/50 bg-surface-elevated shadow-elevated'
      )}
    >
      <div className="flex items-start gap-2">
        {onToggleDone && (
          <button
            onClick={(e) => {
              // The whole card is a drag handle and opens the dialog on click.
              e.stopPropagation()
              onToggleDone()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors',
              finished
                ? 'border-success bg-success text-white'
                : 'border-border opacity-0 hover:border-success/70 group-hover/card:opacity-100'
            )}
            title={finished ? 'Marcar como não concluído' : 'Marcar como concluído'}
          >
            {finished && <Check className="h-3 w-3" strokeWidth={3} />}
          </button>
        )}
        <p
          className={cn(
            'min-w-0 flex-1 text-sm leading-snug',
            finished && 'text-muted-foreground line-through'
          )}
        >
          {card.title}
        </p>
      </div>

      {card.notes && (
        <p
          className={cn(
            'mt-1.5 line-clamp-2 text-xs text-muted-foreground',
            finished && 'line-through decoration-muted-foreground/40'
          )}
        >
          {card.notes}
        </p>
      )}

      {(tasks.length > 0 || card.tags.length > 0 || card.dueDate || assetCount > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {assetCount > 0 && (
            <span className="flex items-center gap-1 rounded-md bg-surface-elevated px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              {assetCount}
            </span>
          )}
          {tasks.length > 0 && (
            <span
              className={cn(
                'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                doneTasks === tasks.length
                  ? 'bg-success/15 text-success'
                  : 'bg-primary/15 text-primary'
              )}
            >
              <ListChecks className="h-3 w-3" />
              {doneTasks}/{tasks.length}
            </span>
          )}
          {card.dueDate && (
            <span className="flex items-center gap-1 rounded-md bg-surface-elevated px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {new Date(card.dueDate).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short'
              })}
            </span>
          )}
          {card.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-surface-elevated px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}
