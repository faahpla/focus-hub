import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAppStore } from '@/stores/app-store'
import { uid } from '@/lib/utils'
import type { CardBrand, FinanceCard } from '@shared/finance'
import { CARD_BRAND_LABEL, FINANCE_COLORS } from '@shared/finance'
import { ColorPicker, Field, MoneyInput } from './form'
import { AccountSelect } from './pickers'
import { useFinance } from '../hooks/use-finance'

const BRANDS: CardBrand[] = ['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'other']
const DAYS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `Dia ${i + 1}` }))

export function CardDialog({
  card,
  onClose
}: {
  card?: FinanceCard
  onClose: () => void
}): JSX.Element {
  const finance = useFinance()
  const saveFinance = useAppStore((s) => s.saveFinance)
  const deleteFinance = useAppStore((s) => s.deleteFinance)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [draft, setDraft] = useState<FinanceCard>(
    () =>
      card ?? {
        id: uid(),
        name: '',
        bank: '',
        brand: 'mastercard',
        color: FINANCE_COLORS[finance.cards.length % FINANCE_COLORS.length],
        limit: 0,
        closingDay: 1,
        dueDay: 10,
        archived: false,
        order: finance.cards.length,
        createdAt: new Date().toISOString()
      }
  )
  const patch = (values: Partial<FinanceCard>): void => setDraft((d) => ({ ...d, ...values }))
  const canSave = draft.name.trim().length > 0

  const save = async (): Promise<void> => {
    if (!canSave) return
    await saveFinance('cards', draft)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogTitle className="mb-4">{card ? 'Editar cartão' : 'Novo cartão'}</DialogTitle>

        {/* Live preview — the card as it will show up on the list. */}
        <div
          className="mb-5 rounded-2xl p-4"
          style={{
            background: `linear-gradient(135deg, hsl(${draft.color} / 0.85), hsl(${draft.color} / 0.35))`
          }}
        >
          <p className="text-xs text-white/70">{draft.bank || 'Banco'}</p>
          <p className="mt-4 text-lg font-semibold text-white">{draft.name || 'Nome do cartão'}</p>
          <div className="mt-1 flex items-center justify-between text-xs text-white/80">
            <span>{CARD_BRAND_LABEL[draft.brand]}</span>
            <span>
              Fecha dia {draft.closingDay} · vence dia {draft.dueDay}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <Input
              autoFocus
              value={draft.name}
              placeholder="Nubank Ultravioleta"
              onChange={(e) => patch({ name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) void save()
              }}
            />
          </Field>
          <Field label="Banco">
            <Input
              value={draft.bank}
              placeholder="Nubank"
              onChange={(e) => patch({ bank: e.target.value })}
            />
          </Field>
          <Field label="Bandeira">
            <Select<CardBrand>
              value={draft.brand}
              options={BRANDS.map((b) => ({ value: b, label: CARD_BRAND_LABEL[b] }))}
              onChange={(brand) => patch({ brand })}
            />
          </Field>
          <Field label="Limite total">
            <MoneyInput value={draft.limit} onChange={(limit) => patch({ limit })} />
          </Field>
          <Field label="Fechamento da fatura">
            <Select<string>
              value={String(draft.closingDay)}
              options={DAYS}
              onChange={(v) => patch({ closingDay: Number(v) })}
            />
          </Field>
          <Field label="Vencimento da fatura">
            <Select<string>
              value={String(draft.dueDay)}
              options={DAYS}
              onChange={(v) => patch({ dueDay: Number(v) })}
            />
          </Field>
          <Field
            label="Conta que paga a fatura"
            className="sm:col-span-2"
            hint="Usada como padrão quando você registrar o pagamento da fatura."
          >
            <AccountSelect value={draft.accountId} onChange={(accountId) => patch({ accountId })} />
          </Field>
          <Field label="Cor" className="sm:col-span-2">
            <ColorPicker
              value={draft.color}
              colors={FINANCE_COLORS}
              onChange={(color) => patch({ color })}
            />
          </Field>
        </div>

        <div className="mt-6 flex items-center gap-2 border-t border-border/60 pt-4">
          {card &&
            (confirmDelete ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    void deleteFinance('cards', card.id)
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
