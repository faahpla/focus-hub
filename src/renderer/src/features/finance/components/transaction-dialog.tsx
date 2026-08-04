import { useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  Copy,
  Paperclip,
  Star,
  Trash2,
  X
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { useAppStore } from '@/stores/app-store'
import { useToastStore } from '@/stores/toast-store'
import { uid } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { PaymentMethod, Transaction, TransactionType } from '@shared/finance'
import { PAYMENT_METHOD_LABEL } from '@shared/finance'
import { Field, MoneyInput, SegmentedControl, TagsInput } from './form'
import { AccountSelect, CardSelect, CategorySelect, ProjectSelect } from './pickers'
import { useFinance } from '../hooks/use-finance'
import { allTags } from '../services/finance-engine'
import { buildInstallments } from '../services/installments-service'
import { formatMoney } from '../utils/money'
import { nowTime, today } from '@/lib/dates'

const METHODS: PaymentMethod[] = ['pix', 'debit', 'credit', 'cash', 'boleto', 'transfer', 'other']

function blankTransaction(type: TransactionType = 'expense'): Transaction {
  const stamp = new Date().toISOString()
  return {
    id: uid(),
    type,
    amount: 0,
    description: '',
    date: today(),
    time: nowTime(),
    method: type === 'income' ? 'pix' : 'debit',
    tags: [],
    paid: true,
    createdAt: stamp,
    updatedAt: stamp
  }
}

interface Props {
  /** Row being edited; omit to create a new one. */
  transaction?: Transaction
  defaultType?: TransactionType
  /** Pre-fills the card and forces credit — used by "lançar no cartão". */
  defaultCardId?: string
  onClose: () => void
}

/**
 * The single place a transaction is created or edited.
 *
 * Installments are only offered while creating: rewriting the parcels of an
 * existing purchase would silently change rows the user may have already
 * reconciled, so editing one parcel edits exactly that parcel.
 */
export function TransactionDialog({
  transaction,
  defaultType,
  defaultCardId,
  onClose
}: Props): JSX.Element {
  const finance = useFinance()
  const saveFinance = useAppStore((s) => s.saveFinance)
  const deleteFinance = useAppStore((s) => s.deleteFinance)
  const deleteTransactions = useAppStore((s) => s.deleteTransactions)
  const pushToast = useToastStore((s) => s.push)

  const isNew = !transaction
  const [draft, setDraft] = useState<Transaction>(() => {
    if (transaction) return { ...transaction, tags: [...transaction.tags] }
    const base = blankTransaction(defaultType)
    if (defaultCardId) return { ...base, method: 'credit', cardId: defaultCardId }
    // Fall back to the first account so a quick entry needs fewer decisions.
    return { ...base, accountId: finance.accounts.find((a) => !a.archived)?.id }
  })
  const [installments, setInstallments] = useState(1)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const tags = useMemo(() => allTags(finance.transactions), [finance.transactions])
  const patch = (values: Partial<Transaction>): void => setDraft((d) => ({ ...d, ...values }))

  const isTransfer = draft.type === 'transfer'
  const isCredit = draft.method === 'credit' && !isTransfer
  const canSave = draft.amount > 0 && draft.description.trim().length > 0

  const save = async (): Promise<void> => {
    if (!canSave) return
    const stamp = new Date().toISOString()

    if (isNew && installments > 1 && !isTransfer) {
      // The rest pattern strips the fields each parcel computes for itself.
      const { id, amount, date, createdAt, updatedAt, paid, installment, ...base } = draft
      const rows = buildInstallments({
        total: amount,
        count: installments,
        firstDate: date,
        base
      })
      await saveFinance('transactions', rows)
      pushToast({
        title: `${installments}x de ${formatMoney(rows[rows.length - 1].amount)}`,
        description: `${draft.description} lançado em ${installments} parcelas.`,
        variant: 'success'
      })
      onClose()
      return
    }

    await saveFinance('transactions', { ...draft, updatedAt: stamp })
    onClose()
  }

  const duplicate = async (): Promise<void> => {
    const stamp = new Date().toISOString()
    await saveFinance('transactions', {
      ...draft,
      id: uid(),
      date: today(),
      installment: undefined,
      recurringId: undefined,
      createdAt: stamp,
      updatedAt: stamp
    })
    pushToast({ title: 'Transação duplicada', variant: 'success' })
    onClose()
  }

  const remove = async (): Promise<void> => {
    if (!transaction) return
    // A parcel belongs to a purchase — offer to take the whole thing.
    if (transaction.installment) {
      const group = finance.transactions
        .filter((t) => t.installment?.groupId === transaction.installment!.groupId)
        .map((t) => t.id)
      await deleteTransactions(group)
      pushToast({ title: `Parcelamento excluído (${group.length}x)`, variant: 'default' })
    } else {
      await deleteFinance('transactions', transaction.id)
    }
    onClose()
  }

  const pickAttachment = async (): Promise<void> => {
    const path = await window.focusHub.pickPath('file')
    if (path) patch({ attachment: path })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogTitle className="sr-only">
          {isNew ? 'Nova transação' : 'Editar transação'}
        </DialogTitle>

        {/* Type + amount headline */}
        <div className="mb-5">
          <SegmentedControl<TransactionType>
            value={draft.type}
            onChange={(type) =>
              patch({
                type,
                method: type === 'transfer' ? 'transfer' : draft.method === 'transfer' ? 'pix' : draft.method,
                cardId: type === 'transfer' ? undefined : draft.cardId
              })
            }
            options={[
              {
                value: 'income',
                label: 'Receita',
                icon: <ArrowDownLeft className="h-3.5 w-3.5" />,
                activeClass: 'bg-success/15 text-success shadow-soft'
              },
              {
                value: 'expense',
                label: 'Despesa',
                icon: <ArrowUpRight className="h-3.5 w-3.5" />,
                activeClass: 'bg-destructive/15 text-destructive shadow-soft'
              },
              {
                value: 'transfer',
                label: 'Transferência',
                icon: <ArrowLeftRight className="h-3.5 w-3.5" />
              }
            ]}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor">
            <MoneyInput autoFocus value={draft.amount} onChange={(amount) => patch({ amount })} />
          </Field>
          <Field label="Descrição">
            <Input
              value={draft.description}
              placeholder={isTransfer ? 'Transferência entre contas' : 'Ex: Mercado do mês'}
              onChange={(e) => patch({ description: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) void save()
              }}
            />
          </Field>

          {!isTransfer && (
            <Field label="Categoria">
              <CategorySelect
                value={draft.categoryId}
                scope={draft.type === 'income' ? 'income' : 'expense'}
                onChange={(categoryId) => patch({ categoryId })}
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

          {isCredit ? (
            <Field label="Cartão">
              <CardSelect value={draft.cardId} onChange={(cardId) => patch({ cardId })} />
            </Field>
          ) : (
            <Field label={isTransfer ? 'De' : 'Conta'}>
              <AccountSelect
                value={draft.accountId}
                onChange={(accountId) => patch({ accountId })}
                exclude={isTransfer ? draft.toAccountId : undefined}
              />
            </Field>
          )}

          {isTransfer && (
            <Field label="Para">
              <AccountSelect
                value={draft.toAccountId}
                onChange={(toAccountId) => patch({ toAccountId })}
                placeholder="Conta de destino"
                exclude={draft.accountId}
              />
            </Field>
          )}

          <Field label="Data">
            <DatePicker
              value={draft.date}
              onChange={(date) => patch({ date: date ?? today() })}
              placeholder="Hoje"
            />
          </Field>
          <Field label="Hora">
            <Input
              type="time"
              value={draft.time ?? ''}
              onChange={(e) => patch({ time: e.target.value || undefined })}
              className="tabular"
            />
          </Field>

          {isNew && !isTransfer && (
            <Field
              label="Parcelamento"
              hint={
                installments > 1
                  ? `${installments}x de ${formatMoney(Math.floor(draft.amount / installments))} · lança ${installments} transações`
                  : 'À vista'
              }
            >
              <Select<string>
                value={String(installments)}
                options={Array.from({ length: 24 }, (_, i) => ({
                  value: String(i + 1),
                  label: i === 0 ? 'À vista' : `${i + 1}x`
                }))}
                onChange={(v) => setInstallments(Number(v))}
              />
            </Field>
          )}

          <Field label="Projeto (opcional)" hint="Conta no orçamento do projeto no Focus HUB.">
            <ProjectSelect value={draft.projectId} onChange={(projectId) => patch({ projectId })} />
          </Field>
        </div>

        <div className="mt-4 space-y-4">
          <Field label="Tags">
            <TagsInput
              tags={draft.tags}
              suggestions={tags}
              onChange={(next) => patch({ tags: next })}
            />
          </Field>

          <Field label="Observações">
            <Textarea
              value={draft.notes ?? ''}
              placeholder="Qualquer detalhe que você vai querer lembrar depois."
              onChange={(e) => patch({ notes: e.target.value || undefined })}
              className="min-h-[80px]"
            />
          </Field>

          {/* Comprovante */}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => void pickAttachment()}>
              <Paperclip className="h-3.5 w-3.5" />
              {draft.attachment ? 'Trocar comprovante' : 'Anexar comprovante'}
            </Button>
            {draft.attachment && (
              <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs">
                <button
                  className="no-drag min-w-0 truncate text-muted-foreground hover:text-foreground"
                  title={draft.attachment}
                  onClick={() => void window.focusHub.openPath(draft.attachment!)}
                >
                  {draft.attachment.split(/[\\/]/).pop()}
                </button>
                <button
                  className="no-drag text-muted-foreground hover:text-destructive"
                  onClick={() => patch({ attachment: undefined })}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-2">
            <Toggle
              on={draft.paid}
              onClick={() => patch({ paid: !draft.paid })}
              onLabel={draft.type === 'income' ? 'Recebido' : 'Pago'}
              offLabel={draft.type === 'income' ? 'A receber' : 'A pagar'}
              icon={<Check className="h-3.5 w-3.5" />}
            />
            <Toggle
              on={Boolean(draft.favorite)}
              onClick={() => patch({ favorite: !draft.favorite })}
              onLabel="Favorita"
              offLabel="Favoritar"
              icon={<Star className={cn('h-3.5 w-3.5', draft.favorite && 'fill-current')} />}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-2 border-t border-border/60 pt-4">
          {!isNew && (
            <>
              {confirmDelete ? (
                <>
                  <Button size="sm" variant="destructive" onClick={() => void remove()}>
                    {transaction?.installment ? 'Excluir todas as parcelas' : 'Confirmar exclusão'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void duplicate()}>
                    <Copy className="h-3.5 w-3.5" /> Duplicar
                  </Button>
                </>
              )}
            </>
          )}
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" variant="primary" disabled={!canSave} onClick={() => void save()}>
            {isNew ? 'Adicionar' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Toggle({
  on,
  onClick,
  onLabel,
  offLabel,
  icon
}: {
  on: boolean
  onClick: () => void
  onLabel: string
  offLabel: string
  icon: React.ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'no-drag flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors',
        on
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border/70 text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}
      {on ? onLabel : offLabel}
    </button>
  )
}
