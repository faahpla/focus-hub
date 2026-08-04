import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { DynamicIcon } from '@/components/dynamic-icon'
import { useAppStore } from '@/stores/app-store'
import { uid } from '@/lib/utils'
import type { GoalMetric, GoalPeriod, PlannerGoal } from '@shared/planner'
import {
  GOAL_ICONS_PLANNER,
  GOAL_METRIC_LABEL,
  GOAL_PERIOD_LABEL,
  PLANNER_COLORS
} from '@shared/planner'
import { ColorPicker, Field, IconPicker } from '@/features/finance/components/form'

const METRICS: GoalMetric[] = ['tasks', 'cards', 'hours', 'habit', 'manual']
const PERIODS: GoalPeriod[] = ['week', 'month', 'quarter', 'year', 'none']

/**
 * A production goal. Progress is read from real finished work rather than
 * typed in — the only exception being `manual`, which exists for the things the
 * app cannot see.
 */
export function PlannerGoalDialog({
  goal,
  onClose
}: {
  goal?: PlannerGoal
  onClose: () => void
}): JSX.Element {
  const goals = useAppStore((s) => s.plannerGoals)
  const projects = useAppStore((s) => s.projects)
  const boards = useAppStore((s) => s.boards)
  const habits = useAppStore((s) => s.habits)
  const savePlanner = useAppStore((s) => s.savePlanner)
  const deletePlanner = useAppStore((s) => s.deletePlanner)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [draft, setDraft] = useState<PlannerGoal>(() => {
    const stamp = new Date().toISOString()
    return (
      goal ?? {
        id: uid(),
        name: '',
        icon: 'Target',
        color: PLANNER_COLORS[goals.length % PLANNER_COLORS.length],
        metric: 'cards',
        target: 10,
        manualProgress: 0,
        period: 'month',
        archived: false,
        order: goals.length,
        createdAt: stamp,
        updatedAt: stamp
      }
    )
  })
  const patch = (values: Partial<PlannerGoal>): void => setDraft((d) => ({ ...d, ...values }))
  const canSave = draft.name.trim().length > 0 && draft.target > 0

  const save = async (): Promise<void> => {
    if (!canSave) return
    await savePlanner('plannerGoals', { ...draft, updatedAt: new Date().toISOString() })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogTitle className="mb-4">{goal ? 'Editar meta' : 'Nova meta'}</DialogTitle>

        <div className="space-y-4">
          <Field label="Nome">
            <Input
              autoFocus
              value={draft.name}
              placeholder="Produzir 30 vídeos, 100h de edição…"
              onChange={(e) => patch({ name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) void save()
              }}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="O que contar">
              <Select<GoalMetric>
                value={draft.metric}
                options={METRICS.map((m) => ({ value: m, label: GOAL_METRIC_LABEL[m] }))}
                onChange={(metric) => patch({ metric })}
              />
            </Field>
            <Field label="Quantas">
              <Input
                type="number"
                min={1}
                value={draft.target}
                onChange={(e) => patch({ target: Math.max(1, Number(e.target.value) || 1) })}
                className="tabular"
              />
            </Field>
            <Field label="Período">
              <Select<GoalPeriod>
                value={draft.period}
                options={PERIODS.map((p) => ({ value: p, label: GOAL_PERIOD_LABEL[p] }))}
                onChange={(period) => patch({ period })}
              />
            </Field>
            <Field label="Prazo">
              <DatePicker
                value={draft.deadline}
                onChange={(deadline) => patch({ deadline })}
                placeholder="Sem prazo"
              />
            </Field>
          </div>

          {draft.metric === 'habit' && (
            <Field label="Qual hábito">
              <Select<string>
                value={draft.habitId}
                options={habits
                  .filter((h) => !h.archived)
                  .map((h) => ({
                    value: h.id,
                    label: h.name,
                    adornment: (
                      <DynamicIcon
                        name={h.icon}
                        className="h-3.5 w-3.5"
                        style={{ color: `hsl(${h.color})` }}
                      />
                    )
                  }))}
                onChange={(habitId) => patch({ habitId })}
                placeholder="Escolher hábito"
              />
            </Field>
          )}

          {draft.metric === 'manual' && (
            <Field label="Progresso atual">
              <Input
                type="number"
                min={0}
                value={draft.manualProgress}
                onChange={(e) => patch({ manualProgress: Math.max(0, Number(e.target.value) || 0) })}
                className="tabular"
              />
            </Field>
          )}

          {(draft.metric === 'tasks' || draft.metric === 'hours') && (
            <Field label="Só deste projeto" hint="Deixe vazio para contar tudo.">
              <Select<string>
                value={draft.projectId}
                options={projects
                  .filter((p) => !p.archived)
                  .map((p) => ({
                    value: p.id,
                    label: p.name,
                    adornment: (
                      <DynamicIcon
                        name={p.icon}
                        className="h-3.5 w-3.5"
                        style={{ color: `hsl(${p.color})` }}
                      />
                    )
                  }))}
                onChange={(projectId) => patch({ projectId })}
                onClear={() => patch({ projectId: undefined })}
                clearable
                clearLabel="Todos os projetos"
                placeholder="Todos os projetos"
              />
            </Field>
          )}

          {draft.metric === 'cards' && (
            <Field label="Só deste quadro" hint="Deixe vazio para contar todos os quadros.">
              <Select<string>
                value={draft.boardId}
                options={boards.map((b) => ({
                  value: b.id,
                  label: b.name,
                  adornment: (
                    <DynamicIcon
                      name={b.icon}
                      className="h-3.5 w-3.5"
                      style={{ color: `hsl(${b.color})` }}
                    />
                  )
                }))}
                onChange={(boardId) => patch({ boardId })}
                onClear={() => patch({ boardId: undefined })}
                clearable
                clearLabel="Todos os quadros"
                placeholder="Todos os quadros"
              />
            </Field>
          )}

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
              icons={GOAL_ICONS_PLANNER}
              color={draft.color}
              onChange={(icon) => patch({ icon })}
            />
          </Field>
        </div>

        <div className="mt-6 flex items-center gap-2 border-t border-border/60 pt-4">
          {goal &&
            (confirmDelete ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    void deletePlanner('plannerGoals', goal.id)
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
