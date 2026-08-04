import { useState } from 'react'
import { ImageIcon, Trash2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { useAppStore } from '@/stores/app-store'
import { uid } from '@/lib/utils'
import type { FinanceGoal } from '@shared/finance'
import { FINANCE_COLORS, GOAL_ICONS } from '@shared/finance'
import { ColorPicker, Field, IconPicker, MoneyInput } from './form'
import { AccountSelect, ProjectSelect } from './pickers'
import { useFinance } from '../hooks/use-finance'

export function GoalDialog({
  goal,
  onClose
}: {
  goal?: FinanceGoal
  onClose: () => void
}): JSX.Element {
  const finance = useFinance()
  const saveFinance = useAppStore((s) => s.saveFinance)
  const deleteFinance = useAppStore((s) => s.deleteFinance)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [draft, setDraft] = useState<FinanceGoal>(() => {
    const stamp = new Date().toISOString()
    return (
      goal ?? {
        id: uid(),
        name: '',
        icon: 'Target',
        color: FINANCE_COLORS[finance.goals.length % FINANCE_COLORS.length],
        targetAmount: 0,
        currentAmount: 0,
        archived: false,
        order: finance.goals.length,
        createdAt: stamp,
        updatedAt: stamp
      }
    )
  })
  const patch = (values: Partial<FinanceGoal>): void => setDraft((d) => ({ ...d, ...values }))
  const canSave = draft.name.trim().length > 0 && draft.targetAmount > 0

  const save = async (): Promise<void> => {
    if (!canSave) return
    await saveFinance('goals', { ...draft, updatedAt: new Date().toISOString() })
    onClose()
  }

  const pickImage = async (): Promise<void> => {
    const path = await window.focusHub.pickPath('file')
    if (path) patch({ image: path })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogTitle className="mb-4">{goal ? 'Editar meta' : 'Nova meta'}</DialogTitle>

        <div className="space-y-4">
          <Field label="Nome da meta">
            <Input
              autoFocus
              value={draft.name}
              placeholder="Notebook novo, Viagem, Reserva de emergência…"
              onChange={(e) => patch({ name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) void save()
              }}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor alvo">
              <MoneyInput
                value={draft.targetAmount}
                onChange={(targetAmount) => patch({ targetAmount })}
              />
            </Field>
            <Field label="Já guardado" hint="Depósitos futuros somam automaticamente.">
              <MoneyInput
                value={draft.currentAmount}
                onChange={(currentAmount) => patch({ currentAmount })}
              />
            </Field>
            <Field label="Prazo">
              <DatePicker
                value={draft.deadline}
                onChange={(deadline) => patch({ deadline })}
                placeholder="Sem prazo"
              />
            </Field>
            <Field label="Onde o dinheiro fica">
              <AccountSelect value={draft.accountId} onChange={(accountId) => patch({ accountId })} />
            </Field>
            <Field label="Projeto ligado" className="sm:col-span-2">
              <ProjectSelect value={draft.projectId} onChange={(projectId) => patch({ projectId })} />
            </Field>
          </div>

          <Field label="Imagem de capa">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => void pickImage()}>
                <ImageIcon className="h-3.5 w-3.5" />
                {draft.image ? 'Trocar imagem' : 'Escolher imagem'}
              </Button>
              {draft.image && (
                <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground" title={draft.image}>
                    {draft.image.split(/[\\/]/).pop()}
                  </span>
                  <button
                    className="no-drag text-muted-foreground hover:text-destructive"
                    onClick={() => patch({ image: undefined })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </Field>

          <Field label="Cor">
            <ColorPicker
              value={draft.color}
              colors={FINANCE_COLORS}
              onChange={(color) => patch({ color })}
            />
          </Field>
          <Field label="Ícone">
            <IconPicker
              value={draft.icon}
              icons={GOAL_ICONS}
              color={draft.color}
              onChange={(icon) => patch({ icon })}
            />
          </Field>
          <Field label="Notas">
            <Textarea
              value={draft.notes ?? ''}
              placeholder="Por que essa meta importa?"
              onChange={(e) => patch({ notes: e.target.value || undefined })}
              className="min-h-[70px]"
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
                    void deleteFinance('goals', goal.id)
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
