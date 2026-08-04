import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAppStore } from '@/stores/app-store'
import { uid, cn } from '@/lib/utils'
import type { Habit, HabitFrequency } from '@shared/planner'
import { HABIT_FREQUENCY_LABEL, HABIT_ICONS, PLANNER_COLORS } from '@shared/planner'
import { ColorPicker, Field, IconPicker } from '@/features/finance/components/form'
import { WEEKDAY_NAMES_SHORT } from '@/lib/dates'

const FREQUENCIES: HabitFrequency[] = ['daily', 'weekdays', 'custom', 'weekly-count']

export function HabitDialog({
  habit,
  onClose
}: {
  habit?: Habit
  onClose: () => void
}): JSX.Element {
  const habits = useAppStore((s) => s.habits)
  const savePlanner = useAppStore((s) => s.savePlanner)
  const deletePlanner = useAppStore((s) => s.deletePlanner)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [draft, setDraft] = useState<Habit>(
    () =>
      habit ?? {
        id: uid(),
        name: '',
        icon: 'Sparkles',
        color: PLANNER_COLORS[habits.length % PLANNER_COLORS.length],
        frequency: 'daily',
        graceDaysPerMonth: 2,
        archived: false,
        order: habits.length,
        createdAt: new Date().toISOString(),
        checkins: {}
      }
  )
  const patch = (values: Partial<Habit>): void => setDraft((d) => ({ ...d, ...values }))
  const canSave = draft.name.trim().length > 0

  const save = async (): Promise<void> => {
    if (!canSave) return
    await savePlanner('habits', draft)
    onClose()
  }

  const toggleWeekday = (index: number): void => {
    const current = draft.weekdays ?? []
    patch({
      weekdays: current.includes(index)
        ? current.filter((d) => d !== index)
        : [...current, index].sort()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogTitle className="mb-4">{habit ? 'Editar hábito' : 'Novo hábito'}</DialogTitle>

        <div className="space-y-4">
          <Field label="Nome">
            <Input
              autoFocus
              value={draft.name}
              placeholder="Academia, Água, Leitura…"
              onChange={(e) => patch({ name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) void save()
              }}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Frequência">
              <Select<HabitFrequency>
                value={draft.frequency}
                options={FREQUENCIES.map((f) => ({ value: f, label: HABIT_FREQUENCY_LABEL[f] }))}
                onChange={(frequency) => patch({ frequency })}
              />
            </Field>

            {draft.frequency === 'weekly-count' ? (
              <Field label="Vezes por semana">
                <Select<string>
                  value={String(draft.targetPerWeek ?? 3)}
                  options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({
                    value: String(n),
                    label: `${n}x`
                  }))}
                  onChange={(v) => patch({ targetPerWeek: Number(v) })}
                />
              </Field>
            ) : (
              <Field label="Horário sugerido">
                <Input
                  type="time"
                  value={draft.timeOfDay ?? ''}
                  onChange={(e) => patch({ timeOfDay: e.target.value || undefined })}
                  className="tabular"
                />
              </Field>
            )}
          </div>

          {draft.frequency === 'custom' && (
            <Field label="Dias da semana">
              <div className="flex gap-1.5">
                {WEEKDAY_NAMES_SHORT.map((label, index) => (
                  <button
                    key={label}
                    onClick={() => toggleWeekday(index)}
                    className={cn(
                      'no-drag h-9 flex-1 rounded-lg text-xs transition-colors',
                      (draft.weekdays ?? []).includes(index)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-surface-elevated text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <Field
            label="Dias de tolerância por mês"
            hint="Faltas que a sequência ignora. Um contador que zera na primeira gripe vira punição, não motivação."
          >
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => patch({ graceDaysPerMonth: n })}
                  className={cn(
                    'no-drag h-9 flex-1 rounded-lg text-xs transition-colors',
                    draft.graceDaysPerMonth === n
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-elevated text-muted-foreground hover:text-foreground'
                  )}
                >
                  {n === 0 ? 'Nenhum' : n}
                </button>
              ))}
            </div>
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
              value={draft.icon}
              icons={HABIT_ICONS}
              color={draft.color}
              onChange={(icon) => patch({ icon })}
            />
          </Field>
        </div>

        <div className="mt-6 flex items-center gap-2 border-t border-border/60 pt-4">
          {habit &&
            (confirmDelete ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    void deletePlanner('habits', habit.id)
                    onClose()
                  }}
                >
                  Excluir e perder o histórico
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
