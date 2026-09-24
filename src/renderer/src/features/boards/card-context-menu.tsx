import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Ban,
  CalendarOff,
  CalendarPlus,
  Check,
  ChevronRight,
  CircleCheckBig,
  Copy,
  FolderInput,
  Trash2
} from 'lucide-react'
import { DynamicIcon } from '@/components/dynamic-icon'
import { useAppStore } from '@/stores/app-store'
import { useToastStore } from '@/stores/toast-store'
import { cn, uid } from '@/lib/utils'
import type { Board, BoardCard, BoardColumn } from '@shared/types'
import { addDaysToKey, dayLabel, today } from '@/lib/dates'
import { isCardDone } from './board-templates'

export interface ContextTarget {
  cardId: string
  x: number
  y: number
}

const WIDTH = 224

/**
 * Where the menu is. It drills down in place — root, then the other boards,
 * then one board's columns — instead of opening flyouts that would have to
 * dodge the screen edge on their own.
 */
type View = { step: 'root' } | { step: 'boards' } | { step: 'columns'; boardId: string }

/**
 * Right-click menu for a card on the board.
 *
 * Scheduling a card was only reachable from inside the card dialog, at the
 * bottom of a scrolling rail — which is the same as not existing. Right-click
 * is where people reach for this, so it lives here too.
 */
export function CardContextMenu({
  target,
  board,
  onClose,
  onOpenCard
}: {
  target: ContextTarget
  board: Board
  onClose: () => void
  onOpenCard: (cardId: string) => void
}): JSX.Element | null {
  const cards = useAppStore((s) => s.cards)
  const boards = useAppStore((s) => s.boards)
  const saveCard = useAppStore((s) => s.saveCard)
  const deleteCard = useAppStore((s) => s.deleteCard)
  const pushToast = useToastStore((s) => s.push)
  const ref = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ step: 'root' })

  const card = cards.find((c) => c.id === target.cardId)
  const otherBoards = boards
    .filter((b) => b.id !== board.id && !b.archived)
    .sort((a, b) => a.order - b.order)

  useEffect(() => {
    /*
      Close on a pointer down outside the menu — and only outside it.

      Asking the event where it landed is what makes this work. The menu used
      to guard itself with a stopPropagation on its own div, which could never
      run in time: this listener sits on `window` in the capture phase, so it
      fires before the event has even reached the menu, let alone React's
      handler for it. The menu unmounted on pointerdown and the click that
      followed had no button left to land on, which killed every item in here
      — Excluir was just the one people noticed.
    */
    const closeOutside = (e: PointerEvent): void => {
      if (ref.current?.contains(e.target as Node)) return
      onClose()
    }
    const closeNow = (): void => onClose()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', closeOutside, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', closeNow)
    return () => {
      window.removeEventListener('pointerdown', closeOutside, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', closeNow)
    }
  }, [onClose])

  if (!card) return null

  const finished = isCardDone(card, board.columns)
  const patch = (values: Partial<BoardCard>): void => {
    void saveCard({ ...card, ...values, updatedAt: new Date().toISOString() })
    onClose()
  }

  const schedule = (day: string, label: string): void => {
    patch({ dueDate: day })
    pushToast({
      title: `“${card.title}” entra em ${label}`,
      lines: ['Aparece na tela Hoje e na Agenda. Defina a hora dentro do card.'],
      variant: 'success'
    })
  }

  const duplicate = (): void => {
    const stamp = new Date().toISOString()
    void saveCard({
      ...card,
      id: uid(),
      title: `${card.title} (cópia)`,
      dueDate: undefined,
      dueTime: undefined,
      done: undefined,
      createdAt: stamp,
      updatedAt: stamp,
      order: card.order + 1
    })
    onClose()
  }

  /**
   * Hand the card to another board, into the lane the user picked.
   *
   * The lane is always chosen, never guessed from its name: boards built from
   * different templates rarely share column names ("Roteiro" here, "Roteiros"
   * there), and a card silently landing in the first lane is a card you then
   * have to go and find.
   */
  const moveTo = (destination: Board, column: BoardColumn): void => {
    // Bottom of the lane, the same place a card created there would go.
    const order = cards.filter(
      (c) => c.boardId === destination.id && c.columnId === column.id
    ).length
    // Same rule as dragging between columns: a lane that decides doneness
    // takes it over from a tick made by hand.
    const laneDecides = column.done === true || column.cancelled === true
    void saveCard({
      ...card,
      boardId: destination.id,
      columnId: column.id,
      order,
      ...(laneDecides ? { done: undefined } : {}),
      updatedAt: new Date().toISOString()
    })
    pushToast({
      title: `“${card.title}” foi para ${destination.name}`,
      lines: [`Entrou na coluna ${column.name}.`],
      variant: 'success'
    })
    onClose()
  }

  const chosenBoard =
    view.step === 'columns' ? otherBoards.find((b) => b.id === view.boardId) : undefined

  // Keep the menu on screen when the click lands near an edge.
  const left = Math.min(target.x, window.innerWidth - WIDTH - 8)
  const top = Math.min(target.y, window.innerHeight - 320)

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.12 }}
      style={{ left, top, width: WIDTH }}
      className="fixed z-[60] overflow-hidden rounded-xl border border-border bg-surface-elevated p-1.5 shadow-elevated"
    >
      {view.step === 'root' && (
        <>
          <p className="truncate px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
            {card.title}
          </p>

          <Item
            icon={<CalendarPlus className="h-3.5 w-3.5" />}
            onClick={() => schedule(today(), 'hoje')}
          >
            Enviar para hoje
          </Item>
          <Item
            icon={<CalendarPlus className="h-3.5 w-3.5" />}
            onClick={() => schedule(addDaysToKey(today(), 1), 'amanhã')}
          >
            Enviar para amanhã
          </Item>
          {card.dueDate && (
            <Item
              icon={<CalendarOff className="h-3.5 w-3.5" />}
              onClick={() => patch({ dueDate: undefined, dueTime: undefined })}
            >
              Tirar da Agenda
            </Item>
          )}

          <div className="my-1 h-px bg-border" />

          <Item icon={<Check className="h-3.5 w-3.5" />} onClick={() => patch({ done: !finished })}>
            {finished ? 'Marcar como não concluído' : 'Marcar como concluído'}
          </Item>
          <Item icon={<Copy className="h-3.5 w-3.5" />} onClick={duplicate}>
            Duplicar card
          </Item>
          {otherBoards.length > 0 && (
            <Item
              icon={<FolderInput className="h-3.5 w-3.5" />}
              trailing={<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              onClick={() => setView({ step: 'boards' })}
            >
              Mover para outro quadro
            </Item>
          )}
          <Item
            icon={<Trash2 className="h-3.5 w-3.5" />}
            destructive
            onClick={() => {
              void deleteCard(card.id)
              onClose()
            }}
          >
            Excluir card
          </Item>

          <div className="my-1 h-px bg-border" />
          <Item
            onClick={() => {
              onOpenCard(card.id)
              onClose()
            }}
          >
            Abrir card
          </Item>

          {card.dueDate && (
            <p className="px-2.5 pb-1 pt-1.5 text-[11px] text-muted-foreground">
              Entrega em {dayLabel(card.dueDate)}
              {card.dueTime ? ` às ${card.dueTime}` : ''}
            </p>
          )}
        </>
      )}

      {view.step === 'boards' && (
        <>
          <BackHeader onBack={() => setView({ step: 'root' })}>Mover para…</BackHeader>
          {otherBoards.map((b) => (
            <Item
              key={b.id}
              icon={
                <DynamicIcon
                  name={b.icon}
                  className="h-3.5 w-3.5"
                  style={{ color: `hsl(${b.color})` }}
                />
              }
              trailing={<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              onClick={() => setView({ step: 'columns', boardId: b.id })}
            >
              {b.name}
            </Item>
          ))}
        </>
      )}

      {view.step === 'columns' && chosenBoard && (
        <>
          <BackHeader onBack={() => setView({ step: 'boards' })}>{chosenBoard.name}</BackHeader>
          {[...chosenBoard.columns]
            .sort((a, b) => a.order - b.order)
            .map((column) => (
              <Item
                key={column.id}
                icon={<LaneMark column={column} />}
                onClick={() => moveTo(chosenBoard, column)}
              >
                {column.name}
              </Item>
            ))}
        </>
      )}
    </motion.div>,
    document.body
  )
}

/**
 * The lane's own marker, so landing somewhere that finishes or drops the card
 * is visible before the click rather than discovered after it.
 */
function LaneMark({ column }: { column: BoardColumn }): JSX.Element {
  if (column.cancelled) return <Ban className="h-3.5 w-3.5 text-destructive" />
  if (column.done) return <CircleCheckBig className="h-3.5 w-3.5 text-success" />
  return (
    <span className="flex h-3.5 w-3.5 items-center justify-center">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: `hsl(${column.color})` }}
      />
    </span>
  )
}

function BackHeader({
  children,
  onBack
}: {
  children: React.ReactNode
  onBack: () => void
}): JSX.Element {
  return (
    <button
      onClick={onBack}
      className="no-drag mb-0.5 flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
    >
      <ArrowLeft className="h-3 w-3 shrink-0" />
      <span className="truncate">{children}</span>
    </button>
  )
}

function Item({
  icon,
  trailing,
  children,
  onClick,
  destructive
}: {
  icon?: React.ReactNode
  trailing?: React.ReactNode
  children: React.ReactNode
  onClick: () => void
  destructive?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        'no-drag flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-hover',
        destructive && 'text-destructive hover:bg-destructive/10'
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </button>
  )
}
