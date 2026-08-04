import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { DatePicker } from '@/components/ui/date-picker'
import { useAppStore } from '@/stores/app-store'
import { useToastStore } from '@/stores/toast-store'
import { uid } from '@/lib/utils'
import type { PaymentMethod, RecurrenceFrequency, RecurringRule } from '@shared/finance'
import { FREQUENCY_LABEL, PAYMENT_METHOD_LABEL } from '@shared/finance'
import { Field, MoneyInput, SegmentedControl, TagsInput } from './form'
import { AccountSelect, CardSelect, CategorySelect } from './pickers'
import { useFinance } from '../hooks/use-finance'
import { materializeRecurring, nextOccurrence } from '../services/recurrence-service'
import { MONTH_NAMES_LONG, WEEKDAY_NAMES_SHORT, dayLabel, today } from '../utils/dates'

const METHODS: PaymentMethod[] = ['pix', 'debit', 'credit', 'cash', 'boleto', 'transfer', 'other']
const FREQUENCIES: RecurrenceFrequency[] = ['monthly', 'weekly', 'yearly']

/**
 * Fixed bills and recurring income.
 *
 * Saving also materialises the occurrences right away, so the calendar and the
 * "a pagar" list reflect the new rule without waiting for the next app start.
 */
export function RecurringDialog({
  rule,
  defaultType = 'expense',
  onClose
}: {
  rule?: RecurringRule
  defaultType?: 'income' | 'expense'
  onClose: () => void
}): JSX.Element {
  const finance = useFinance()
  const saveFinance = useAppStore((s) => s.saveFinance)
  const deleteFinance = useAppStore((s) => s.deleteFinance)
  const pushToast = useToastStore((s) => s.push)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [draft, setDraft] = useState<RecurringRule>(() => {
    const stamp = new Date().toISOString()
    return (
      rule ?? {
        id: uid(),
        type: defaultType,
        name: '',
        amount: 0,
        method: defaultType === 'income' ? 'pix' : 'debit',
        frequency: 'monthly',
        dayOfMonth: Number(today().slice(8, 10)),
        startDate: today(),
        autoPay: defaultType === 'income',
        active: true,
        tags: [],
        createdAt: stamp,
        updatedAt: stamp
      }
    )
  })
  const patch = (values: Partial<RecurringRule>): void => setDraft((d) => ({ ...d, ...values }))
  const canSave = draft.name.trim().length > 0 && draft.amount > 0

  const save = async (): Promise<void> => {
    if (!canSave) return
    const next = { ...draft, updatedAt: new Date().toISOString() }
    await saveFinance('recurring', next)
    const created = materializeRecurring([next], finance.transactions)
    if (created.length > 0) await saveFinance('transactions', created)
    pushToast({
      title: rule ? 'Recorrência atualizada' : 'Recorrência criada',
      description:
        created.length > 0
          ? `${created.length} lançamento${created.length === 1 ? '' : 's'} gerado${created.length === 1 ? '' : 's'}.`
          : undefined,
      variant: 'success'
    })
    onClose()
  }

  const upcoming = nextOccurrence(draft)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogTitle className="mb-4">
          {rule ? 'Editar recorrência' : draft.type === 'income' ? 'Nova receita fixa' : 'Nova conta fixa'}
        </DialogTitle>

        <div className="space-y-4">
          <SegmentedControl<'income' | 'expense'>
            value={draft.type}
            onChange={(type) => patch({ type })}
            options={[
              { value: 'expense', label: 'Despesa fixa', activeClass: 'bg-destructive/15 text-destructive shadow-soft' },
              { value: 'income', label: 'Receita fixa', activeClass: 'bg-success/15 text-success shadow-soft' }
            ]}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">
              <Input
                autoFocus
                value={draft.name}
                placeholder={draft.type === 'income' ? 'Salário' : 'Netflix, Aluguel, Internet…'}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </Field>
            <Field label="Valor">
              <MoneyInput value={draft.amount} onChange={(amount) => patch({ amount })} />
            </Field>

            <Field label="Categoria">
              <CategorySelect
                value={draft.categoryId}
                scope={draft.type}
                onChange={(categoryId) => patch({ categoryId })}
              />
            </Field>
            <Field label="Frequência">
              <Select<RecurrenceFrequency>
                value={draft.frequency}
                options={FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }))}
                onChange={(frequency) => patch({ frequency })}
              />
            </Field>

            {draft.frequency === 'weekly' ? (
              <Field label="Dia da semana">
                <Select<string>
                  value={String(draft.weekday ?? 1)}
                  options={WEEKDAY_NAMES_SHORT.map((label, i) => ({ value: String(i), label }))}
                  onChange={(v) => patch({ weekday: Number(v) })}
                />
              </Field>
            ) : (
              <Field label="Dia do mês">
                <Select<string>
                  value={String(draft.dayOfMonth)}
                  options={Array.from({ length: 31 }, (_, i) => ({
                    value: String(i + 1),
                    label: `Dia ${i + 1}`
                  }))}
                  onChange={(v) => patch({ dayOfMonth: Number(v) })}
                />
              </Field>
            )}

            {draft.frequency === 'yearly' && (
              <Field label="Mês">
                <Select<string>
                  value={String(draft.month ?? 0)}
                  options={MONTH_NAMES_LONG.map((label, i) => ({ value: String(i), label }))}
                  onChange={(v) => patch({ month: Number(v) })}
                />
              </Field>
            )}

            <Field label="Forma de pagamento">
              <Select<PaymentMethod>
                value={draft.method}
                options={METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))}
                onChange={(method) =>
                  patch({ method, cardId: method === 'credit' ? draft.cardId : undefined })
                }
              />
            </Field>

            {draft.method === 'credit' ? (
              <Field label="Cartão">
                <CardSelect value={draft.cardId} onChange={(cardId) => patch({ cardId })} />
              </Field>
            ) : (
              <Field label="Conta">
                <AccountSelect value={draft.accountId} onChange={(accountId) => patch({ accountId })} />
              </Field>
            )}

            <Field label="Começa em">
              <DatePicker
                value={draft.startDate}
                onChange={(startDate) => patch({ startDate: startDate ?? today() })}
              />
            </Field>
            <Field label="Termina em">
              <DatePicker
                value={draft.endDate}
                onChange={(endDate) => patch({ endDate })}
                placeholder="Sem fim"
              />
            </Field>
          </div>

          <Field label="Tags">
            <TagsInput tags={draft.tags} onChange={(tags) => patch({ tags })} />
          </Field>

          <Field label="Observações">
            <Textarea
              value={draft.notes ?? ''}
              onChange={(e) => patch({ notes: e.target.value || undefined })}
              className="min-h-[60px]"
            />
          </Field>

          <div className="space-y-2 rounded-xl border border-border/70 bg-surface/50 p-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm">
                Lançar já como {draft.type === 'income' ? 'recebido' : 'pago'}
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {draft.autoPay
                    ? 'Débito automático ou salário — entra direto no saldo.'
                    : 'Aparece como pendente até você confirmar.'}
                </span>
              </span>
              <Switch checked={draft.autoPay} onCheckedChange={(autoPay) => patch({ autoPay })} />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm">
                Ativa
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Desligar para de gerar novos lançamentos, sem apagar o histórico.
                </span>
              </span>
              <Switch checked={draft.active} onCheckedChange={(active) => patch({ active })} />
            </label>
          </div>

          {upcoming && (
            <p className="text-xs text-muted-foreground">
              Próximo lançamento: <span className="text-foreground">{dayLabel(upcoming)}</span>
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center gap-2 border-t border-border/60 pt-4">
          {rule &&
            (confirmDelete ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    void deleteFinance('recurring', rule.id)
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
