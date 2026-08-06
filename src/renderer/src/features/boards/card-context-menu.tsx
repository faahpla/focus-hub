import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { CalendarOff, CalendarPlus, Check, Copy, Trash2 } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { useToastStore } from '@/stores/toast-store'
import { cn, uid } from '@/lib/utils'
import type { Board, BoardCard } from '@shared/types'
import { addDaysToKey, dayLabel, today } from '@/lib/dates'
import { isCardDone } from './board-templates'

export interface ContextTarget {
  cardId: string
  x: number
  y: number
}

const WIDTH = 224

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
  const saveCard = useAppStore((s) => s.saveCard)
  const deleteCard = useAppStore((s) => s.deleteCard)
  const pushToast = useToastStore((s) => s.push)
  const ref = useRef<HTMLDivElement>(null)

  const card = cards.find((c) => c.id === target.cardId)

  useEffect(() => {
    const close = (): void => onClose()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    // Capture phase so the menu closes before the click lands on anything else.
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
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
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed z-[60] overflow-hidden rounded-xl border border-border bg-surface-elevated p-1.5 shadow-elevated"
    >
      <p className="truncate px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
        {card.title}
      </p>

      <Item icon={<CalendarPlus className="h-3.5 w-3.5" />} onClick={() => schedule(today(), 'hoje')}>
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
      <Item onClick={() => { onOpenCard(card.id); onClose() }}>Abrir card</Item>

      {card.dueDate && (
        <p className="px-2.5 pb-1 pt-1.5 text-[11px] text-muted-foreground">
          Entrega em {dayLabel(card.dueDate)}
          {card.dueTime ? ` às ${card.dueTime}` : ''}
        </p>
      )}
    </motion.div>,
    document.body
  )
}

function Item({
  icon,
  children,
  onClick,
  destructive
}: {
  icon?: React.ReactNode
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
      <span className="truncate">{children}</span>
    </button>
  )
}
