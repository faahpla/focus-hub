import { useState } from 'react'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DynamicIcon } from '@/components/dynamic-icon'
import { useAppStore } from '@/stores/app-store'
import { uid } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { CategoryScope, FinanceCategory } from '@shared/finance'
import { CATEGORY_ICONS, FINANCE_COLORS } from '@shared/finance'
import { ColorPicker, Field, IconPicker } from './form'
import { useFinance } from '../hooks/use-finance'

const SCOPES: { value: CategoryScope; label: string }[] = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income', label: 'Receita' },
  { value: 'both', label: 'Ambas' }
]

/**
 * Categories and subcategories, fully editable.
 *
 * Deleting a category never deletes transactions — they simply lose the label,
 * which keeps a year of history intact after a moment of tidying up.
 */
export function CategoryManager({ onClose }: { onClose: () => void }): JSX.Element {
  const finance = useFinance()
  const saveFinance = useAppStore((s) => s.saveFinance)
  const deleteFinance = useAppStore((s) => s.deleteFinance)

  const [editing, setEditing] = useState<FinanceCategory | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const parents = finance.categories
    .filter((c) => !c.parentId && !c.archived)
    .sort((a, b) => a.order - b.order)

  const startNew = (parentId?: string): void =>
    setEditing({
      id: uid(),
      name: '',
      icon: parentId ? 'Shapes' : CATEGORY_ICONS[0],
      color: FINANCE_COLORS[finance.categories.length % FINANCE_COLORS.length],
      scope: 'expense',
      parentId,
      archived: false,
      order: finance.categories.length
    })

  const usageOf = (id: string): number =>
    finance.transactions.filter((t) => t.categoryId === id || t.subcategoryId === id).length

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[86vh] max-w-2xl overflow-y-auto">
        <DialogTitle className="mb-1">Categorias</DialogTitle>
        <p className="mb-4 text-sm text-muted-foreground">
          Renomeie, mude a cor ou crie subcategorias. Excluir uma categoria mantém as transações —
          elas apenas ficam sem rótulo.
        </p>

        {editing ? (
          <CategoryEditor
            category={editing}
            onCancel={() => setEditing(null)}
            onSave={async (next) => {
              await saveFinance('categories', next)
              setEditing(null)
            }}
          />
        ) : (
          <>
            <div className="space-y-1">
              {parents.map((parent) => {
                const children = finance.categories.filter(
                  (c) => c.parentId === parent.id && !c.archived
                )
                return (
                  <div key={parent.id}>
                    <Row
                      category={parent}
                      count={usageOf(parent.id)}
                      confirming={confirmDelete === parent.id}
                      onEdit={() => setEditing(parent)}
                      onAddChild={() => startNew(parent.id)}
                      onDelete={() => setConfirmDelete(parent.id)}
                      onConfirmDelete={() => {
                        void deleteFinance('categories', parent.id)
                        setConfirmDelete(null)
                      }}
                      onCancelDelete={() => setConfirmDelete(null)}
                    />
                    {children.map((child) => (
                      <Row
                        key={child.id}
                        category={child}
                        count={usageOf(child.id)}
                        nested
                        confirming={confirmDelete === child.id}
                        onEdit={() => setEditing(child)}
                        onDelete={() => setConfirmDelete(child.id)}
                        onConfirmDelete={() => {
                          void deleteFinance('categories', child.id)
                          setConfirmDelete(null)
                        }}
                        onCancelDelete={() => setConfirmDelete(null)}
                      />
                    ))}
                  </div>
                )
              })}
            </div>

            <div className="mt-5 flex items-center gap-2 border-t border-border/60 pt-4">
              <Button size="sm" variant="secondary" onClick={() => startNew()}>
                <Plus className="h-3.5 w-3.5" /> Nova categoria
              </Button>
              <div className="flex-1" />
              <Button size="sm" variant="ghost" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Row({
  category,
  count,
  nested,
  confirming,
  onEdit,
  onAddChild,
  onDelete,
  onConfirmDelete,
  onCancelDelete
}: {
  category: FinanceCategory
  count: number
  nested?: boolean
  confirming: boolean
  onEdit: () => void
  onAddChild?: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}): JSX.Element {
  return (
    <div
      className={cn(
        'group flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-surface-hover/60',
        nested && 'ml-7'
      )}
    >
      {nested && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `hsl(${category.color} / 0.16)`, color: `hsl(${category.color})` }}
      >
        <DynamicIcon name={category.icon} className="h-3.5 w-3.5" />
      </span>
      <button onClick={onEdit} className="no-drag min-w-0 flex-1 truncate text-left text-sm">
        {category.name}
      </button>
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {count > 0 ? `${count} lançamento${count === 1 ? '' : 's'}` : 'sem uso'}
      </span>

      {confirming ? (
        <>
          <Button size="sm" variant="destructive" onClick={onConfirmDelete}>
            Excluir
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancelDelete}>
            Cancelar
          </Button>
        </>
      ) : (
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onAddChild && (
            <Button size="sm" variant="ghost" className="px-2" onClick={onAddChild} title="Subcategoria">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="px-2 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

function CategoryEditor({
  category,
  onSave,
  onCancel
}: {
  category: FinanceCategory
  onSave: (next: FinanceCategory) => Promise<void>
  onCancel: () => void
}): JSX.Element {
  const [draft, setDraft] = useState(category)
  const patch = (values: Partial<FinanceCategory>): void => setDraft((d) => ({ ...d, ...values }))
  const canSave = draft.name.trim().length > 0

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={draft.parentId ? 'Nome da subcategoria' : 'Nome'}>
          <Input
            autoFocus
            value={draft.name}
            placeholder="Ex: Delivery"
            onChange={(e) => patch({ name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSave) void onSave(draft)
            }}
          />
        </Field>
        <Field label="Aparece em">
          <Select<CategoryScope>
            value={draft.scope}
            options={SCOPES}
            onChange={(scope) => patch({ scope })}
          />
        </Field>
      </div>
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
          icons={CATEGORY_ICONS}
          color={draft.color}
          onChange={(icon) => patch({ icon })}
        />
      </Field>

      <div className="flex items-center gap-2 border-t border-border/60 pt-4">
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" variant="primary" disabled={!canSave} onClick={() => void onSave(draft)}>
          Salvar
        </Button>
      </div>
    </div>
  )
}
