import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { DatePicker } from '@/components/ui/date-picker'
import { useAppStore } from '@/stores/app-store'
import { uid } from '@/lib/utils'
import type { CalendarEvent } from '@shared/planner'
import { EVENT_ICONS, PLANNER_COLORS } from '@shared/planner'
import { ColorPicker, Field, IconPicker } from '@/features/finance/components/form'
import { today } from '@/lib/dates'
import { addMinutes } from '../utils/time'

/**
 * A commitment. Kept intentionally thin next to a task: an event is something
 * you attend, so it has no priority, no estimate and no dependencies — and the
 * scheduler treats it as immovable rather than as work to be arranged.
 */
export function EventDialog({
  event,
  defaultDay,
  defaultStart,
  onClose
}: {
  event?: CalendarEvent
  defaultDay?: string
  defaultStart?: string
  onClose: () => void
}): JSX.Element {
  const savePlanner = useAppStore((s) => s.savePlanner)
  const deletePlanner = useAppStore((s) => s.deletePlanner)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [draft, setDraft] = useState<CalendarEvent>(() => {
    const stamp = new Date().toISOString()
    const start = defaultStart ?? '09:00'
    return (
      event ?? {
        id: uid(),
        title: '',
        date: defaultDay ?? today(),
        startTime: start,
        endTime: addMinutes(start, 60),
        color: PLANNER_COLORS[0],
        icon: 'CalendarDays',
        createdAt: stamp,
        updatedAt: stamp
      }
    )
  })

  const patch = (values: Partial<CalendarEvent>): void => setDraft((d) => ({ ...d, ...values }))
  const canSave = draft.title.trim().length > 0 && draft.endTime > draft.startTime

  const save = async (): Promise<void> => {
    if (!canSave) return
    await savePlanner('events', { ...draft, updatedAt: new Date().toISOString() })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogTitle className="mb-4">{event ? 'Editar compromisso' : 'Novo compromisso'}</DialogTitle>

        <div className="space-y-4">
          <Field label="Título">
            <Input
              autoFocus
              value={draft.title}
              placeholder="Reunião, consulta, aula…"
              onChange={(e) => patch({ title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) void save()
              }}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Data">
              <DatePicker
                value={draft.date}
                onChange={(date) => patch({ date: date ?? today() })}
              />
            </Field>
            <Field label="Início">
              <Input
                type="time"
                disabled={draft.allDay}
                value={draft.startTime}
                onChange={(e) => {
                  const startTime = e.target.value || '09:00'
                  // Keep the duration when the start moves, instead of letting
                  // the end fall behind it and produce a negative event.
                  const length = Math.max(
                    15,
                    minutesBetween(draft.startTime, draft.endTime)
                  )
                  patch({ startTime, endTime: addMinutes(startTime, length) })
                }}
                className="tabular"
              />
            </Field>
            <Field label="Fim">
              <Input
                type="time"
                disabled={draft.allDay}
                value={draft.endTime}
                onChange={(e) => patch({ endTime: e.target.value || draft.endTime })}
                className="tabular"
              />
            </Field>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface/50 p-3">
            <span className="text-sm">
              Dia todo
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Aparece no topo do dia e não ocupa um bloco de horário.
              </span>
            </span>
            <Switch checked={Boolean(draft.allDay)} onCheckedChange={(allDay) => patch({ allDay })} />
          </label>

          <Field label="Local">
            <Input
              value={draft.location ?? ''}
              placeholder="Onde é? (opcional)"
              onChange={(e) => patch({ location: e.target.value || undefined })}
            />
          </Field>

          <Field label="Notas">
            <Textarea
              value={draft.notes ?? ''}
              onChange={(e) => patch({ notes: e.target.value || undefined })}
              className="min-h-[70px]"
            />
          </Field>

          <Field label="Cor">
            <ColorPicker
              value={draft.color}
              colors={PLANNER_COLORS}
              onChange={(color) => patch({ color })}
            />
          </Field>
          <Field label="Ícone">
            <IconPicker
              value={draft.icon ?? 'CalendarDays'}
              icons={EVENT_ICONS}
              color={draft.color}
              onChange={(icon) => patch({ icon })}
            />
          </Field>
        </div>

        <div className="mt-6 flex items-center gap-2 border-t border-border/60 pt-4">
          {event &&
            (confirmDelete ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    void deletePlanner('events', event.id)
                    onClose()
                  }}
                >
                  Confirmar exclusão
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
            ))}
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" variant="primary" disabled={!canSave} onClick={() => void save()}>
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}
