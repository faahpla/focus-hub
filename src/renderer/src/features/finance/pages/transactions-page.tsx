import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownUp,
  Download,
  Filter,
  Plus,
  Search,
  Star,
  Tags,
  X
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { useFinanceUi } from '@/stores/finance-ui-store'
import { useToastStore } from '@/stores/toast-store'
import { cn } from '@/lib/utils'
import type { Transaction, TransactionType } from '@shared/finance'
import { Money } from '../components/money'
import { TransactionDialog } from '../components/transaction-dialog'
import { TransactionList } from '../components/transaction-list'
import { CategoryManager } from '../components/category-manager'
import { AccountSelect, CardSelect, CategorySelect } from '../components/pickers'
import { Field, SegmentedControl } from '../components/form'
import { useFinance } from '../hooks/use-finance'
import {
  type SortKey,
  allTags,
  filterTransactions,
  sortTransactions,
  totalsOf
} from '../services/finance-engine'
import { toCsvRows } from '../services/reports-service'

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'date-desc', label: 'Mais recentes' },
  { value: 'date-asc', label: 'Mais antigas' },
  { value: 'amount-desc', label: 'Maior valor' },
  { value: 'amount-asc', label: 'Menor valor' }
]

export function TransactionsPage(): JSX.Element {
  const finance = useFinance()
  const pushToast = useToastStore((s) => s.push)
  const search = useFinanceUi((s) => s.search)
  const setSearch = useFinanceUi((s) => s.setSearch)
  const focusId = useFinanceUi((s) => s.focusId)
  const clearFocus = useFinanceUi((s) => s.clearFocus)

  const [type, setType] = useState<TransactionType | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('date-desc')
  const [showFilters, setShowFilters] = useState(false)
  const [managingCategories, setManagingCategories] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const [categoryId, setCategoryId] = useState<string>()
  const [accountId, setAccountId] = useState<string>()
  const [cardId, setCardId] = useState<string>()
  const [tag, setTag] = useState<string>()
  const [from, setFrom] = useState<string>()
  const [to, setTo] = useState<string>()
  const [onlyPending, setOnlyPending] = useState(false)
  const [onlyFavorites, setOnlyFavorites] = useState(false)

  // A highlight arriving from an alert should fade once it has been seen.
  useEffect(() => {
    if (!focusId) return
    const timer = setTimeout(clearFocus, 4000)
    return () => clearTimeout(timer)
  }, [focusId, clearFocus])

  const tags = useMemo(() => allTags(finance.transactions), [finance.transactions])

  const rows = useMemo(() => {
    const filtered = filterTransactions(
      finance.transactions,
      {
        query: search,
        types: type === 'all' ? undefined : new Set([type]),
        categoryIds: categoryId ? new Set([categoryId]) : undefined,
        accountIds: accountId ? new Set([accountId]) : undefined,
        cardIds: cardId ? new Set([cardId]) : undefined,
        tags: tag ? new Set([tag]) : undefined,
        from,
        to,
        onlyPending,
        onlyFavorites
      },
      finance.categories
    )
    return sortTransactions(filtered, sort)
  }, [
    finance.transactions,
    finance.categories,
    search,
    type,
    categoryId,
    accountId,
    cardId,
    tag,
    from,
    to,
    onlyPending,
    onlyFavorites,
    sort
  ])

  const totals = useMemo(() => totalsOf(rows), [rows])
  const activeFilters =
    [categoryId, accountId, cardId, tag, from, to].filter(Boolean).length +
    (onlyPending ? 1 : 0) +
    (onlyFavorites ? 1 : 0)

  const clearFilters = (): void => {
    setCategoryId(undefined)
    setAccountId(undefined)
    setCardId(undefined)
    setTag(undefined)
    setFrom(undefined)
    setTo(undefined)
    setOnlyPending(false)
    setOnlyFavorites(false)
  }

  const exportCsv = async (): Promise<void> => {
    const result = await window.focusHub.exportTransactionsCsv(toCsvRows(finance, rows))
    if (result.ok) {
      pushToast({
        title: 'CSV exportado',
        description: `${rows.length} transações salvas.`,
        variant: 'success'
      })
    }
  }

  return (
    <div className="space-y-4 px-8 pb-24">
      {/* Search + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[15rem] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder="Buscar por descrição, categoria, tag ou valor…"
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="no-drag absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Button
          variant={showFilters || activeFilters > 0 ? 'secondary' : 'ghost'}
          onClick={() => setShowFilters((s) => !s)}
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFilters > 0 && (
            <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {activeFilters}
            </span>
          )}
        </Button>
        <Select<SortKey>
          value={sort}
          options={SORTS}
          onChange={setSort}
          align="end"
          className="w-[10.5rem]"
        />
        <Button variant="ghost" onClick={() => void exportCsv()} title="Exportar em CSV">
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="ghost" onClick={() => setManagingCategories(true)} title="Categorias">
          <Tags className="h-4 w-4" />
        </Button>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nova
        </Button>
      </div>

      {/* Type tabs + running totals */}
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<TransactionType | 'all'>
          value={type}
          onChange={setType}
          className="w-full max-w-md"
          options={[
            { value: 'all', label: 'Todas' },
            { value: 'income', label: 'Receitas', activeClass: 'bg-success/15 text-success shadow-soft' },
            { value: 'expense', label: 'Despesas', activeClass: 'bg-destructive/15 text-destructive shadow-soft' },
            { value: 'transfer', label: 'Transferências' }
          ]}
        />
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{rows.length} resultado(s)</span>
          <span>
            Entradas <Money cents={totals.income} className="text-success" />
          </span>
          <span>
            Saídas <Money cents={totals.expense} className="text-destructive" />
          </span>
          <span>
            Saldo <Money cents={totals.net} colored />
          </span>
        </div>
      </div>

      {showFilters && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Categoria">
              <CategorySelect value={categoryId} onChange={setCategoryId} />
            </Field>
            <Field label="Conta">
              <AccountSelect value={accountId} onChange={setAccountId} />
            </Field>
            <Field label="Cartão">
              <CardSelect value={cardId} onChange={setCardId} />
            </Field>
            <Field label="De">
              <DatePicker value={from} onChange={setFrom} placeholder="Início" />
            </Field>
            <Field label="Até">
              <DatePicker value={to} onChange={setTo} placeholder="Fim" />
            </Field>
            <Field label="Tag">
              <Select<string>
                value={tag}
                options={tags.map((t) => ({ value: t, label: `#${t}` }))}
                onChange={setTag}
                onClear={() => setTag(undefined)}
                clearable
                clearLabel="Qualquer tag"
                placeholder="Tag"
              />
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <FilterChip active={onlyPending} onClick={() => setOnlyPending((v) => !v)}>
              <ArrowDownUp className="h-3 w-3" /> Só pendentes
            </FilterChip>
            <FilterChip active={onlyFavorites} onClick={() => setOnlyFavorites((v) => !v)}>
              <Star className={cn('h-3 w-3', onlyFavorites && 'fill-current')} /> Só favoritas
            </FilterChip>
            <div className="flex-1" />
            {activeFilters > 0 && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}
          </div>
        </Card>
      )}

      <TransactionList
        transactions={rows}
        onOpen={setEditing}
        focusId={focusId}
        empty={
          search || activeFilters > 0
            ? 'Nada encontrado com esses filtros.'
            : 'Nenhuma transação ainda. Clique em “Nova” para começar.'
        }
      />

      {creating && <TransactionDialog onClose={() => setCreating(false)} />}
      {editing && <TransactionDialog transaction={editing} onClose={() => setEditing(null)} />}
      {managingCategories && <CategoryManager onClose={() => setManagingCategories(false)} />}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        'no-drag flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors',
        active
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border/70 text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}
