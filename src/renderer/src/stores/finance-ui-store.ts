import { create } from 'zustand'
import { currentMonth } from '@/features/finance/utils/dates'

export type FinanceTab =
  | 'dashboard'
  | 'transactions'
  | 'accounts'
  | 'cards'
  | 'installments'
  | 'recurring'
  | 'goals'
  | 'budget'
  | 'calendar'
  | 'reports'

/**
 * View state for the Finance HUB — which tab is open, which month is being
 * looked at, whether the PIN has been entered this run. Deliberately separate
 * from the document store: none of it belongs on disk.
 */
interface FinanceUiState {
  tab: FinanceTab
  month: string
  /** Set once the PIN is accepted; resets when the app restarts. */
  unlocked: boolean
  /** Id to scroll to and flash after arriving from an alert. */
  focusId?: string
  search: string

  setTab: (tab: FinanceTab, focusId?: string) => void
  setMonth: (month: string) => void
  stepMonth: (delta: number) => void
  unlock: () => void
  lock: () => void
  setSearch: (search: string) => void
  clearFocus: () => void
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
}

export const useFinanceUi = create<FinanceUiState>((set) => ({
  tab: 'dashboard',
  month: currentMonth(),
  unlocked: false,
  search: '',

  setTab: (tab, focusId) => set({ tab, focusId }),
  setMonth: (month) => set({ month }),
  stepMonth: (delta) => set((s) => ({ month: shiftMonth(s.month, delta) })),
  unlock: () => set({ unlocked: true }),
  lock: () => set({ unlocked: false }),
  setSearch: (search) => set({ search }),
  clearFocus: () => set({ focusId: undefined })
}))
