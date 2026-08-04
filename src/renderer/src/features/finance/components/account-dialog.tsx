import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAppStore } from '@/stores/app-store'
import { uid } from '@/lib/utils'
import type { AccountKind, FinanceAccount } from '@shared/finance'
import { ACCOUNT_ICONS, ACCOUNT_KIND_LABEL, FINANCE_COLORS } from '@shared/finance'
import { Field, ColorPicker, IconPicker, MoneyInput } from './form'
import { useFinance } from '../hooks/use-finance'

const KINDS: AccountKind[] = ['checking', 'savings', 'wallet', 'investment', 'business']

export function AccountDialog({
  account,
  onClose
}: {
  account?: FinanceAccount
  onClose: () => void
}): JSX.Element {
  const finance = useFinance()
  const saveFinance = useAppStore((s) => s.saveFinance)
  const deleteFinance = useAppStore((s) => s.deleteFinance)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [draft, setDraft] = useState<FinanceAccount>(
    () =>
      account ?? {
        id: uid(),
        name: '',
        kind: 'checking',
        icon: 'Landmark',
        color: FINANCE_COLORS[finance.accounts.length % FINANCE_COLORS.length],
        openingBalance: 0,
        archived: false,
        order: finance.accounts.length,
        createdAt: new Date().toISOString()
      }
  )
  const patch = (values: Partial<FinanceAccount>): void => setDraft((d) => ({ ...d, ...values }))
  const canSave = draft.name.trim().length > 0

  const save = async (): Promise<void> => {
    if (!canSave) return
    await saveFinance('accounts', draft)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogTitle className="mb-4">{account ? 'Editar conta' : 'Nova conta'}</DialogTitle>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">
              <Input
                autoFocus
                value={draft.name}
                placeholder="Nubank, Carteira, Inter…"
                onChange={(e) => patch({ name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSave) void save()
                }}
              />
            </Field>
            <Field label="Tipo">
              <Select<AccountKind>
                value={draft.kind}
                options={KINDS.map((k) => ({ value: k, label: ACCOUNT_KIND_LABEL[k] }))}
                onChange={(kind) => patch({ kind })}
              />
            </Field>
          </div>

          <Field
            label="Saldo atual"
            hint={
              account
                ? 'Este é o saldo inicial: as transações são somadas a ele.'
                : 'Quanto há nessa conta hoje. As próximas transações partem daqui.'
            }
          >
            <MoneyInput
              value={draft.openingBalance}
              onChange={(openingBalance) => patch({ openingBalance })}
            />
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
              icons={ACCOUNT_ICONS}
              color={draft.color}
              onChange={(icon) => patch({ icon })}
            />
          </Field>
        </div>

        <div className="mt-6 flex items-center gap-2 border-t border-border/60 pt-4">
          {account &&
            (confirmDelete ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    void deleteFinance('accounts', account.id)
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
