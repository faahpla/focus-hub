import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen,
  Check,
  KanbanSquare,
  Maximize2,
  Pause,
  Play,
  Search,
  Square,
  Target
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { useSessionStore } from '@/stores/session-store'
import { useSyncStore } from '@/stores/sync-store'
import { useNavigatorStore } from '@/stores/navigator-store'
import { personOf } from '@/features/sharing/people'
import { PersonChip } from '@/features/sharing/person-badge'
import {
  deliveries,
  dueLabel,
  isLate,
  nextStep,
  pickNext,
  type Delivery
} from '@/features/boards/card-flow'
import { ScriptReader } from '@/features/boards/script-reader'
import { focusOnCard } from '@/features/session/focus-card'
import { toPlainText } from '@/lib/rich-text'
import { cn } from '@/lib/utils'
import type { BoardCard } from '@shared/types'

/**
 * The top of the home screen: what to do now, with the button that starts it.
 *
 * While a focus session runs, that session. Otherwise the most urgent open
 * delivery (see pickNext) with its steps and
 * the next one ready to focus on. The timer used to sit apart from the work
 * and got forgotten; here starting it is the obvious next click.
 */
export function NextDelivery(): JSX.Element {
  const phase = useSessionStore((s) => s.phase)
  const sessionCardId = useSessionStore((s) => s.cardId)
  const cards = useAppStore((s) => s.cards)
  const boards = useAppStore((s) => s.boards)
  const me = useSyncStore((s) => s.status.userId)

  const next = useMemo<Delivery | undefined>(
    () => pickNext(deliveries(cards, boards), me),
    [cards, boards, me]
  )

  if (phase === 'running' || phase === 'paused') {
    return <RunningSession card={cards.find((c) => c.id === sessionCardId)} />
  }
  if (!next) return <NothingDue />
  return <DeliveryHero delivery={next} me={me ?? undefined} />
}

/** The id of the card the hero shows, so the list under it can leave it out. */
export function useHeroCardId(): string | undefined {
  const phase = useSessionStore((s) => s.phase)
  const sessionCardId = useSessionStore((s) => s.cardId)
  const cards = useAppStore((s) => s.cards)
  const boards = useAppStore((s) => s.boards)
  const me = useSyncStore((s) => s.status.userId)
  return useMemo(() => {
    if (phase === 'running' || phase === 'paused') return sessionCardId
    return pickNext(deliveries(cards, boards), me)?.card.id
  }, [phase, sessionCardId, cards, boards, me])
}

function DeliveryHero({ delivery, me }: { delivery: Delivery; me?: string }): JSX.Element {
  const { card, board } = delivery
  const openCard = useNavigatorStore((s) => s.openCard)
  const [reading, setReading] = useState(false)
  const steps = card.checklist ?? []
  const step = nextStep(card)
  const assignee = personOf(board, card.assigneeId, me)
  const late = isLate(card)
  const hasScript = toPlainText(card.notes ?? '').trim().length > 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-5',
        late ? 'border-destructive/40 bg-destructive/[0.06]' : 'border-primary/30 bg-primary/[0.06]'
      )}
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: `hsl(${board.color})` }}
      />
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
        <span className={cn('uppercase tracking-wide', late ? 'text-destructive' : 'text-primary')}>
          Próxima entrega
        </span>
        <span className="text-muted-foreground">· {board.name} ·</span>
        <span className={cn('tabular', late ? 'text-destructive' : 'text-muted-foreground')}>
          {dueLabel(card)}
        </span>
        {assignee && <PersonChip person={assignee} />}
      </div>

      <button
        onClick={() => openCard(card.id)}
        className="no-drag mt-1.5 block max-w-full truncate text-left text-xl font-semibold tracking-tight transition-colors hover:text-primary"
        title="Abrir o card"
      >
        {card.title}
      </button>

      {steps.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {steps.map((s) => {
            const current = s.id === step?.id
            return (
              <span
                key={s.id}
                className={cn(
                  'flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px]',
                  s.done && 'border-success/30 bg-success/10 text-success',
                  current && 'border-primary/50 bg-primary/15 font-semibold text-primary',
                  !s.done && !current && 'border-border/70 text-muted-foreground'
                )}
              >
                {s.done && <Check className="h-3 w-3" />}
                {s.label}
              </span>
            )
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => focusOnCard(card, { step, start: true })}>
          <Play className="h-4 w-4" />
          {step ? `Focar em ${step.label}` : steps.length > 0 ? 'Focar (etapas feitas)' : 'Focar neste card'}
        </Button>
        {hasScript && (
          <Button variant="secondary" onClick={() => setReading(true)}>
            <BookOpen className="h-4 w-4" /> Ler roteiro
          </Button>
        )}
        <Button variant="ghost" onClick={() => openCard(card.id)}>
          Abrir card
        </Button>
      </div>

      {reading && <CardReader card={card} onClose={() => setReading(false)} />}
    </motion.div>
  )
}

/** The script of a card in the reader, saved straight to the card. */
function CardReader({ card, onClose }: { card: BoardCard; onClose: () => void }): JSX.Element {
  const saveCard = useAppStore((s) => s.saveCard)
  return (
    <ScriptReader
      rich
      title={card.title}
      value={card.notes ?? ''}
      onCommit={(notes) => {
        // The freshest card, so this write never undoes another field.
        const fresh = useAppStore.getState().cards.find((c) => c.id === card.id)
        if (fresh) void saveCard({ ...fresh, notes })
      }}
      onClose={onClose}
    />
  )
}

function RunningSession({ card }: { card?: BoardCard }): JSX.Element {
  const navigate = useNavigate()
  const openCard = useNavigatorStore((s) => s.openCard)
  const phase = useSessionStore((s) => s.phase)
  const title = useSessionStore((s) => s.taskTitle)
  const togglePause = useSessionStore((s) => s.togglePause)
  const stop = useSessionStore((s) => s.stop)
  const remaining = useSessionStore((s) => Math.max(0, Math.ceil(s.plannedSeconds - s.focusedSeconds)))
  const progress = useSessionStore((s) => (s.plannedSeconds > 0 ? s.focusedSeconds / s.plannedSeconds : 0))
  const [reading, setReading] = useState(false)
  const paused = phase === 'paused'
  const clock = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
  const hasScript = card ? toPlainText(card.notes ?? '').trim().length > 0 : false

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-primary/[0.08] p-5">
      <div
        className="absolute inset-x-0 bottom-0 h-1 bg-primary/70 transition-[width] duration-1000"
        style={{ width: `${progress * 100}%` }}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-primary">
            <Target className="h-3.5 w-3.5" /> {paused ? 'Foco pausado' : 'Focando agora'}
          </p>
          <p className="mt-1 truncate text-xl font-semibold tracking-tight">{title}</p>
        </div>
        <span className="text-4xl font-bold tabular tracking-tight">{clock}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={togglePause}>
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          {paused ? 'Continuar' : 'Pausar'}
        </Button>
        <Button variant="secondary" onClick={() => void stop(false)}>
          <Square className="h-3.5 w-3.5" /> Encerrar
        </Button>
        {hasScript && card && (
          <Button variant="secondary" onClick={() => setReading(true)}>
            <BookOpen className="h-4 w-4" /> Ler roteiro
          </Button>
        )}
        {card && (
          <Button variant="ghost" onClick={() => openCard(card.id)}>
            Abrir card
          </Button>
        )}
        <Button variant="ghost" onClick={() => navigate('/foco')}>
          <Maximize2 className="h-3.5 w-3.5" /> Modo foco
        </Button>
      </div>
      {reading && card && <CardReader card={card} onClose={() => setReading(false)} />}
    </div>
  )
}

function NothingDue(): JSX.Element {
  const navigate = useNavigate()
  const setSearchOpen = useNavigatorStore((s) => s.setSearchOpen)
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-border/80 p-5">
      <div>
        <p className="text-sm font-medium">Nenhuma entrega marcada para os próximos 7 dias.</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Dê uma data a um card no quadro e ele aparece aqui, com a próxima etapa pronta para focar.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setSearchOpen(true)}>
          <Search className="h-4 w-4" /> Buscar card
        </Button>
        <Button variant="primary" onClick={() => navigate('/boards')}>
          <KanbanSquare className="h-4 w-4" /> Abrir quadros
        </Button>
      </div>
    </div>
  )
}
