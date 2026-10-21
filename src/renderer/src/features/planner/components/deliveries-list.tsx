import { useMemo, useState } from 'react'
import { Check, KanbanSquare, Play } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useAppStore } from '@/stores/app-store'
import { useSyncStore } from '@/stores/sync-store'
import { useNavigatorStore } from '@/stores/navigator-store'
import { personOf } from '@/features/sharing/people'
import { PersonChip } from '@/features/sharing/person-badge'
import { deliveries, isLate, nextStep, type Delivery } from '@/features/boards/card-flow'
import { focusOnCard } from '@/features/session/focus-card'
import { relativeDayLabel } from '@/lib/dates'
import { cn } from '@/lib/utils'

const MINE_KEY = 'focus-hub:deliveries-mine'

function readMine(): boolean {
  try {
    return localStorage.getItem(MINE_KEY) === '1'
  } catch {
    return false
  }
}

/** "Atrasadas", "Hoje", "Amanhã", "Sex, 24 Out". */
function groupOf(d: Delivery): string {
  if (d.daysLeft < 0) return 'Atrasadas'
  return relativeDayLabel(d.card.dueDate!)
}

/**
 * The week's deliveries, grouped by day, each with how far its steps got and
 * whose it is. The hero above already shows the first one, so it is left out.
 */
export function DeliveriesList({ skipId }: { skipId?: string }): JSX.Element | null {
  const cards = useAppStore((s) => s.cards)
  const boards = useAppStore((s) => s.boards)
  const me = useSyncStore((s) => s.status.userId)
  const [mineOnly, setMineOnly] = useState(readMine)

  const all = useMemo(() => deliveries(cards, boards), [cards, boards])
  // Only worth offering when someone else actually has cards.
  const othersHaveCards = all.some((d) => d.card.assigneeId && d.card.assigneeId !== me)
  const shown = all.filter(
    (d) =>
      d.card.id !== skipId &&
      (!mineOnly || !othersHaveCards || !d.card.assigneeId || d.card.assigneeId === me)
  )

  const groups = useMemo(() => {
    const out: { label: string; items: Delivery[] }[] = []
    for (const d of shown) {
      const label = groupOf(d)
      const last = out[out.length - 1]
      if (last?.label === label) last.items.push(d)
      else out.push({ label, items: [d] })
    }
    return out
  }, [shown])

  if (all.length === 0) return null

  const toggleMine = (): void => {
    const next = !mineOnly
    setMineOnly(next)
    try {
      localStorage.setItem(MINE_KEY, next ? '1' : '0')
    } catch {
      /* the choice just won't be remembered */
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <KanbanSquare className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold text-muted-foreground">Entregas da semana</h3>
        </div>
        {othersHaveCards && (
          <button
            onClick={toggleMine}
            className={cn(
              'no-drag rounded-md px-2 py-0.5 text-[11px] transition-colors',
              mineOnly
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
            )}
          >
            {mineOnly ? 'Só as minhas' : 'Todas'}
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="px-1 py-4 text-center text-xs text-muted-foreground">
          Só a de cima por enquanto.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.label}>
              <p
                className={cn(
                  'mb-1 px-1 text-[11px] font-medium',
                  group.label === 'Atrasadas' ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((d) => (
                  <DeliveryRow key={d.card.id} delivery={d} me={me ?? undefined} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function DeliveryRow({ delivery, me }: { delivery: Delivery; me?: string }): JSX.Element {
  const { card, board } = delivery
  const openCard = useNavigatorStore((s) => s.openCard)
  const steps = card.checklist ?? []
  const done = steps.filter((s) => s.done).length
  const step = nextStep(card)
  const assignee = personOf(board, card.assigneeId, me)
  const late = isLate(card)

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors',
        late
          ? 'border-destructive/30 bg-destructive/[0.05] hover:bg-destructive/10'
          : 'border-border/60 bg-surface/40 hover:bg-surface-hover'
      )}
    >
      <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ background: `hsl(${board.color})` }} />
      <button onClick={() => openCard(card.id)} className="no-drag min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium">{card.title}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="shrink-0">{board.name}</span>
          {steps.length > 0 && (
            <>
              <span className="flex h-1 w-14 shrink-0 overflow-hidden rounded-full bg-border/60">
                <span
                  className={cn('h-full', done === steps.length ? 'bg-success' : 'bg-primary')}
                  style={{ width: `${(done / steps.length) * 100}%` }}
                />
              </span>
              <span className="truncate">
                {step ? `falta ${step.label}` : (
                  <span className="inline-flex items-center gap-0.5 text-success">
                    <Check className="h-3 w-3" /> etapas feitas
                  </span>
                )}
              </span>
            </>
          )}
        </div>
      </button>
      {assignee && <PersonChip person={assignee} />}
      <span
        className={cn(
          'w-12 shrink-0 text-right text-xs tabular',
          late ? 'text-destructive' : 'text-muted-foreground'
        )}
      >
        {delivery.daysLeft < 0 ? 'há ' + -delivery.daysLeft + 'd' : (card.dueTime ?? '—')}
      </span>
      <button
        onClick={() => focusOnCard(card, { start: true })}
        title={step ? `Focar em ${step.label}` : 'Focar neste card'}
        aria-label={step ? `Focar em ${step.label}` : 'Focar neste card'}
        className="no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-primary/15 hover:text-primary group-hover:opacity-100"
      >
        <Play className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
