import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Layers,
  Plus,
  Repeat,
  Sparkles,
  KanbanSquare,
  SquareCheck
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { useToastStore } from '@/stores/toast-store'
import { usePlannerUi, type AgendaLayers, type AgendaView } from '@/stores/planner-ui-store'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '@shared/planner'
import type { BoardCard, Task } from '@shared/types'
import { TaskDetailDialog } from '@/features/projects/task-detail-dialog'
import { CardDetailDialog } from '@/features/boards/card-detail-dialog'
import { Timeline } from '../components/timeline'
import { MonthGrid } from '../components/month-grid'
import { AgendaList } from '../components/agenda-list'
import { EventDialog } from '../components/event-dialog'
import { CapacityBar } from '../components/capacity-bar'
import { useCapacity } from '../hooks/use-planner'
import { applyPlan, planDay } from '../services/scheduler'
import { formatMinutes, nowClock } from '../utils/time'
import {
  dayLabel,
  monthLabel,
  today,
  weekDays,
  weekLabel,
  weekdayLong
} from '@/lib/dates'

const VIEWS: { id: AgendaView; label: string }[] = [
  { id: 'day', label: 'Dia' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
  { id: 'list', label: 'Lista' }
]

const LAYERS: { id: keyof AgendaLayers; label: string; icon: React.ElementType }[] = [
  { id: 'tasks', label: 'Tarefas', icon: SquareCheck },
  { id: 'cards', label: 'Cards dos quadros', icon: KanbanSquare },
  { id: 'events', label: 'Compromissos', icon: CalendarDays },
  { id: 'habits', label: 'Hábitos', icon: Repeat },
  { id: 'finance', label: 'Financeiro', icon: CircleDollarSign }
]

/**
 * One calendar for everything.
 *
 * The Finance HUB already had a calendar of its own, and habits and tasks would
 * each have wanted another. Four calendars is exactly the "pile of separate
 * tools" this app is trying not to be — so there is one, and the layers decide
 * what it draws.
 */
export function AgendaPage(): JSX.Element {
  const { day, view, layers, setDay, stepDay, goToday, setView, toggleLayer } = usePlannerUi()
  const tasks = useAppStore((s) => s.tasks)
  const events = useAppStore((s) => s.events)
  const settings = useAppStore((s) => s.planner)
  const saveTasks = useAppStore((s) => s.saveTasks)
  const pushToast = useToastStore((s) => s.push)

  const boards = useAppStore((s) => s.boards)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [openCard, setOpenCard] = useState<BoardCard | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [creating, setCreating] = useState<{ day: string; start?: string } | null>(null)
  const [showLayers, setShowLayers] = useState(false)

  const capacity = useCapacity(day)
  const days = useMemo(() => (view === 'week' ? weekDays(day) : [day]), [view, day])

  const step = (delta: number): void => {
    if (view === 'week') stepDay(delta * 7)
    else if (view === 'month') {
      const [y, m] = day.split('-').map(Number)
      const next = new Date(y, m - 1 + delta, 1)
      setDay(
        `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`
      )
    } else stepDay(delta)
  }

  const title =
    view === 'week'
      ? weekLabel(day)
      : view === 'month'
        ? monthLabel(day.slice(0, 7), true)
        : `${weekdayLong(day)}, ${dayLabel(day)}`

  const organize = (): void => {
    const plan = planDay({
      day,
      tasks,
      events,
      settings,
      notBefore: day === today() ? nowClock() : undefined
    })
    const changed = applyPlan(plan, tasks)
    if (changed.length > 0) void saveTasks(changed)
    pushToast({
      title: plan.placements.length > 0 ? 'Dia organizado' : 'Nada para encaixar',
      lines: [
        `${plan.placements.length} tarefa(s) em ${formatMinutes(plan.usedMinutes)}.`,
        ...(plan.rejections.length > 0 ? [plan.rejections[0].reason] : [])
      ],
      variant: plan.placements.length > 0 ? 'success' : 'default'
    })
  }

  const openTask = (task: Task): void => setOpenTaskId(task.id)
  const openCardBoard = openCard ? boards.find((b) => b.id === openCard.boardId) : undefined

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-8 pb-4 pt-8">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-2xl font-semibold tracking-tight first-letter:uppercase">
            {title}
          </h1>
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-border/70 bg-surface/50 p-1">
            <Button size="sm" variant="ghost" className="px-2" onClick={() => step(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={goToday}
              className={cn(
                'no-drag rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                day === today() ? 'text-foreground' : 'text-primary hover:bg-surface-hover'
              )}
            >
              Hoje
            </button>
            <Button size="sm" variant="ghost" className="px-2" onClick={() => step(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-border/70 bg-surface/50 p-1">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  'no-drag rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
                  view === item.id
                    ? 'bg-surface-elevated text-foreground shadow-soft'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Button
              variant={showLayers ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setShowLayers((s) => !s)}
              title="Camadas"
            >
              <Layers className="h-4 w-4" />
            </Button>
            <AnimatePresence>
              {showLayers && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute right-0 top-11 z-30 w-52 rounded-xl border border-border bg-surface-elevated p-1.5 shadow-elevated"
                >
                  {LAYERS.map((layer) => (
                    <button
                      key={layer.id}
                      onClick={() => toggleLayer(layer.id)}
                      className="no-drag flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-surface-hover"
                    >
                      <layer.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 text-left">{layer.label}</span>
                      <span
                        className={cn(
                          'h-3.5 w-3.5 rounded border transition-colors',
                          layers[layer.id]
                            ? 'border-primary bg-primary'
                            : 'border-border bg-transparent'
                        )}
                      />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {view !== 'month' && (
            <Button variant="secondary" onClick={organize}>
              <Sparkles className="h-4 w-4" /> Organizar
            </Button>
          )}
          <Button variant="primary" onClick={() => setCreating({ day })}>
            <Plus className="h-4 w-4" /> Compromisso
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-8 pb-24">
        {view === 'day' && (
          <div className="mb-4 max-w-sm">
            <CapacityBar capacity={capacity} />
          </div>
        )}

        {view === 'month' ? (
          <MonthGrid
            month={day.slice(0, 7)}
            layers={layers}
            onOpenTask={openTask}
            onOpenEvent={setEditingEvent}
            onOpenCard={setOpenCard}
            onPickDay={(picked) => {
              setDay(picked)
              setView('day')
            }}
          />
        ) : view === 'list' ? (
          <AgendaList
            day={day}
            layers={layers}
            onOpenTask={openTask}
            onOpenEvent={setEditingEvent}
            onOpenCard={setOpenCard}
          />
        ) : (
          <Card className="overflow-hidden p-3">
            <Timeline
              days={days}
              layers={layers}
              onOpenTask={openTask}
              onOpenEvent={setEditingEvent}
              onOpenCard={setOpenCard}
              onCreate={(pickedDay, start) => setCreating({ day: pickedDay, start })}
            />
            <p className="px-2 pt-2 text-[11px] text-muted-foreground">
              Arraste os blocos para mudar horário ou dia · dê dois cliques num espaço vazio para
              criar um compromisso
            </p>
          </Card>
        )}
      </div>

      {openTaskId && <TaskDetailDialog taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
      {openCard && openCardBoard && (
        <CardDetailDialog
          cardId={openCard.id}
          board={openCardBoard}
          onClose={() => setOpenCard(null)}
        />
      )}
      {editingEvent && (
        <EventDialog event={editingEvent} onClose={() => setEditingEvent(null)} />
      )}
      {creating && (
        <EventDialog
          defaultDay={creating.day}
          defaultStart={creating.start}
          onClose={() => setCreating(null)}
        />
      )}
    </div>
  )
}
