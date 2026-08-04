import { Select, type SelectOption } from '@/components/ui/select'
import { useAppStore } from '@/stores/app-store'
import { DynamicIcon } from '@/components/dynamic-icon'
import { useFinance } from '../hooks/use-finance'
import { formatMoney } from '../utils/money'
import { accountBalance } from '../services/finance-engine'

function dot(color: string): JSX.Element {
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: `hsl(${color})` }}
    />
  )
}

function icon(name: string, color: string): JSX.Element {
  return (
    <DynamicIcon name={name} className="h-4 w-4 shrink-0" style={{ color: `hsl(${color})` }} />
  )
}

/**
 * Category picker. Subcategories are shown indented under their parent so the
 * hierarchy reads without a second dropdown.
 */
export function CategorySelect({
  value,
  onChange,
  scope,
  clearable = true
}: {
  value?: string
  onChange: (id?: string) => void
  scope?: 'income' | 'expense'
  clearable?: boolean
}): JSX.Element {
  const finance = useFinance()
  const usable = finance.categories.filter(
    (c) => !c.archived && (!scope || c.scope === scope || c.scope === 'both')
  )
  const parents = usable.filter((c) => !c.parentId).sort((a, b) => a.order - b.order)

  const options: SelectOption<string>[] = []
  for (const parent of parents) {
    options.push({ value: parent.id, label: parent.name, adornment: icon(parent.icon, parent.color) })
    for (const child of usable.filter((c) => c.parentId === parent.id)) {
      options.push({
        value: child.id,
        label: `↳ ${child.name}`,
        adornment: dot(child.color)
      })
    }
  }

  return (
    <Select
      value={value}
      options={options}
      onChange={onChange}
      onClear={() => onChange(undefined)}
      clearable={clearable}
      clearLabel="Sem categoria"
      placeholder="Categoria"
    />
  )
}

export function AccountSelect({
  value,
  onChange,
  placeholder = 'Conta',
  clearable = true,
  exclude
}: {
  value?: string
  onChange: (id?: string) => void
  placeholder?: string
  clearable?: boolean
  exclude?: string
}): JSX.Element {
  const finance = useFinance()
  const options: SelectOption<string>[] = finance.accounts
    .filter((a) => !a.archived && a.id !== exclude)
    .sort((a, b) => a.order - b.order)
    .map((account) => ({
      value: account.id,
      label: account.name,
      adornment: icon(account.icon, account.color),
      hint: formatMoney(accountBalance(account, finance.transactions))
    }))

  return (
    <Select
      value={value}
      options={options}
      onChange={onChange}
      onClear={() => onChange(undefined)}
      clearable={clearable}
      clearLabel="Nenhuma conta"
      placeholder={placeholder}
    />
  )
}

export function CardSelect({
  value,
  onChange,
  clearable = true
}: {
  value?: string
  onChange: (id?: string) => void
  clearable?: boolean
}): JSX.Element {
  const finance = useFinance()
  const options: SelectOption<string>[] = finance.cards
    .filter((c) => !c.archived)
    .sort((a, b) => a.order - b.order)
    .map((card) => ({
      value: card.id,
      label: card.name,
      adornment: dot(card.color),
      hint: card.bank
    }))

  return (
    <Select
      value={value}
      options={options}
      onChange={onChange}
      onClear={() => onChange(undefined)}
      clearable={clearable}
      clearLabel="Nenhum cartão"
      placeholder="Cartão"
    />
  )
}

/** Links a transaction or goal to a Focus HUB project. */
export function ProjectSelect({
  value,
  onChange
}: {
  value?: string
  onChange: (id?: string) => void
}): JSX.Element {
  // The selector returns the stored array by reference; filtering happens
  // after it, so no new array is created inside the subscription.
  const projects = useAppStore((s) => s.projects).filter((p) => !p.archived)
  const options: SelectOption<string>[] = projects.map((p) => ({
    value: p.id,
    label: p.name,
    adornment: icon(p.icon, p.color)
  }))

  return (
    <Select
      value={value}
      options={options}
      onChange={onChange}
      onClear={() => onChange(undefined)}
      clearable
      clearLabel="Sem projeto"
      placeholder="Projeto"
    />
  )
}
