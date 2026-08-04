/**
 * Finance HUB — domain contract shared between the Electron main process and
 * the React renderer.
 *
 * MONEY IS ALWAYS AN INTEGER NUMBER OF CENTS. Never store reais as a float —
 * `0.1 + 0.2` is the classic way a ledger silently stops adding up. Conversion
 * to/from the "R$ 1.234,56" the user sees lives in `utils/money.ts`.
 */

import type { ID } from './types'

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export type AccountKind = 'checking' | 'savings' | 'wallet' | 'investment' | 'business'

export interface FinanceAccount {
  id: ID
  name: string
  kind: AccountKind
  icon: string // lucide icon name
  color: string // hsl channels, e.g. "250 82% 68%"
  /** Balance the account already had when it was added, in cents. */
  openingBalance: number
  /** Kept out of pickers and totals, but its history stays readable. */
  archived: boolean
  order: number
  createdAt: string
}

// ---------------------------------------------------------------------------
// Credit cards
// ---------------------------------------------------------------------------

export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'other'

export interface FinanceCard {
  id: ID
  name: string
  bank: string
  brand: CardBrand
  color: string
  /** Total limit in cents. */
  limit: number
  /** Day of month the invoice closes (1-31). */
  closingDay: number
  /** Day of month the invoice is due (1-31). */
  dueDay: number
  /** Account that pays this card's invoice, when known. */
  accountId?: ID
  archived: boolean
  order: number
  createdAt: string
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategoryScope = 'income' | 'expense' | 'both'

export interface FinanceCategory {
  id: ID
  name: string
  icon: string
  color: string
  scope: CategoryScope
  /** Set on subcategories — points at the parent category. */
  parentId?: ID
  archived: boolean
  order: number
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export type TransactionType = 'income' | 'expense' | 'transfer'

export type PaymentMethod =
  | 'pix'
  | 'debit'
  | 'credit'
  | 'cash'
  | 'boleto'
  | 'transfer'
  | 'other'

/** Position of a transaction inside a "12x" purchase. */
export interface InstallmentInfo {
  /** 1-based. */
  number: number
  total: number
  /** Shared by every parcel of the same purchase. */
  groupId: ID
}

export interface Transaction {
  id: ID
  type: TransactionType
  /** Cents, always positive — the sign lives in `type`. */
  amount: number
  categoryId?: ID
  subcategoryId?: ID
  description: string
  /** YYYY-MM-DD (local date, never a UTC timestamp). */
  date: string
  /** HH:mm, optional. */
  time?: string
  method: PaymentMethod
  /** Source account. For a transfer this is the origin. */
  accountId?: ID
  /** Destination account of a transfer. */
  toAccountId?: ID
  /** Set when `method === 'credit'`. */
  cardId?: ID
  installment?: InstallmentInfo
  /** Set when generated from a RecurringRule. */
  recurringId?: ID
  /** Optional link to a Focus HUB project, for per-project budgets. */
  projectId?: ID
  /** Optional link to a goal — a deposit towards it. */
  goalId?: ID
  tags: string[]
  /** Absolute path to a receipt file on disk. */
  attachment?: string
  notes?: string
  favorite?: boolean
  /**
   * False means "scheduled": a bill to pay, an invoice to receive, a future
   * parcel. Balances count only paid rows; forecasts count everything.
   */
  paid: boolean
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Recurring rules (fixed bills and recurring income)
// ---------------------------------------------------------------------------

export type RecurrenceFrequency = 'weekly' | 'monthly' | 'yearly'

export interface RecurringRule {
  id: ID
  type: 'income' | 'expense'
  name: string
  amount: number
  categoryId?: ID
  method: PaymentMethod
  accountId?: ID
  cardId?: ID
  frequency: RecurrenceFrequency
  /** Monthly/yearly: day of month (1-31, clamped to the month's length). */
  dayOfMonth: number
  /** Weekly: 0 = Sunday. */
  weekday?: number
  /** Yearly: 0-11. */
  month?: number
  /** YYYY-MM-DD — nothing is generated before this. */
  startDate: string
  /** YYYY-MM-DD — nothing is generated after this. */
  endDate?: string
  /** Generated rows land already paid (e.g. salary, automatic debit). */
  autoPay: boolean
  active: boolean
  tags: string[]
  notes?: string
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export interface FinanceGoal {
  id: ID
  name: string
  icon: string
  color: string
  /** How much the goal costs, in cents. */
  targetAmount: number
  /** Saved so far, in cents. Deposits are transactions carrying `goalId`. */
  currentAmount: number
  /** YYYY-MM-DD. */
  deadline?: string
  /** Absolute path to a local image, shown as the goal's cover. */
  image?: string
  /** Where the money for this goal lives. */
  accountId?: ID
  /** Optional link to a Focus HUB project. */
  projectId?: ID
  notes?: string
  archived: boolean
  order: number
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Monthly plan
// ---------------------------------------------------------------------------

export interface CategoryBudget {
  categoryId: ID
  /** Cents. */
  limit: number
}

export interface BudgetPlan {
  /** YYYY-MM — one plan per month. */
  month: string
  plannedIncome: number
  spendLimit: number
  saveTarget: number
  investTarget: number
  categories: CategoryBudget[]
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface FinanceSettings {
  currency: string
  locale: string
  /** SHA-256 of the PIN. Absent means the module is not locked. */
  pinHash?: string
  /** Ask for the PIN every time the module is opened. */
  lockOnOpen: boolean
  /** Blur every value on screen — for recording or screen sharing. */
  hideValues: boolean
  alertsEnabled: boolean
  /** Warn when a card's used limit crosses this fraction (0..1). */
  cardAlertThreshold: number
  /** Warn this many days before a bill is due. */
  dueSoonDays: number
  /** Show the finance summary card on the Focus HUB home screen. */
  showOnHome: boolean
}

// ---------------------------------------------------------------------------
// Root document
// ---------------------------------------------------------------------------

export interface FinanceData {
  accounts: FinanceAccount[]
  cards: FinanceCard[]
  categories: FinanceCategory[]
  transactions: Transaction[]
  recurring: RecurringRule[]
  goals: FinanceGoal[]
  budgets: BudgetPlan[]
  settings: FinanceSettings
}

/**
 * Entities the generic finance IPC can address. Adding a new collection means
 * adding one line here — handlers, preload bridge and store stay untouched.
 */
export type FinanceEntity =
  | 'accounts'
  | 'cards'
  | 'categories'
  | 'transactions'
  | 'recurring'
  | 'goals'

export interface FinanceEntityMap {
  accounts: FinanceAccount
  cards: FinanceCard
  categories: FinanceCategory
  transactions: Transaction
  recurring: RecurringRule
  goals: FinanceGoal
}

// ---------------------------------------------------------------------------
// Labels & defaults
// ---------------------------------------------------------------------------

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  wallet: 'Carteira digital',
  investment: 'Investimentos',
  business: 'Conta PJ'
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: 'Pix',
  debit: 'Débito',
  credit: 'Crédito',
  cash: 'Dinheiro',
  boleto: 'Boleto',
  transfer: 'Transferência',
  other: 'Outro'
}

export const CARD_BRAND_LABEL: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  elo: 'Elo',
  amex: 'Amex',
  hipercard: 'Hipercard',
  other: 'Outra'
}

export const FREQUENCY_LABEL: Record<RecurrenceFrequency, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual'
}

export const DEFAULT_FINANCE_SETTINGS: FinanceSettings = {
  currency: 'BRL',
  locale: 'pt-BR',
  lockOnOpen: false,
  hideValues: false,
  alertsEnabled: true,
  cardAlertThreshold: 0.8,
  dueSoonDays: 5,
  showOnHome: true
}

/**
 * Seed categories. Ids are stable strings (not UUIDs) so budgets and reports
 * written on one machine still resolve after an export/import round-trip.
 */
export const SEED_CATEGORIES: Omit<FinanceCategory, 'archived'>[] = [
  { id: 'cat-food', name: 'Alimentação', icon: 'UtensilsCrossed', color: '25 90% 60%', scope: 'expense', order: 0 },
  { id: 'cat-home', name: 'Moradia', icon: 'Home', color: '210 80% 62%', scope: 'expense', order: 1 },
  { id: 'cat-transport', name: 'Transporte', icon: 'Car', color: '45 90% 58%', scope: 'expense', order: 2 },
  { id: 'cat-fun', name: 'Lazer', icon: 'PartyPopper', color: '300 70% 65%', scope: 'expense', order: 3 },
  { id: 'cat-health', name: 'Saúde', icon: 'HeartPulse', color: '350 80% 62%', scope: 'expense', order: 4 },
  { id: 'cat-education', name: 'Educação', icon: 'GraduationCap', color: '190 85% 55%', scope: 'expense', order: 5 },
  { id: 'cat-subscriptions', name: 'Assinaturas', icon: 'Repeat', color: '265 80% 68%', scope: 'expense', order: 6 },
  { id: 'cat-investments', name: 'Investimentos', icon: 'TrendingUp', color: '152 62% 47%', scope: 'both', order: 7 },
  { id: 'cat-salary', name: 'Salário', icon: 'Wallet', color: '152 62% 47%', scope: 'income', order: 8 },
  { id: 'cat-freelance', name: 'Freelance', icon: 'Briefcase', color: '170 70% 50%', scope: 'income', order: 9 },
  { id: 'cat-content', name: 'Criação de conteúdo', icon: 'Clapperboard', color: '270 80% 66%', scope: 'income', order: 10 },
  { id: 'cat-other', name: 'Outros', icon: 'Shapes', color: '240 8% 60%', scope: 'both', order: 11 }
]

export const CATEGORY_ICONS = [
  'UtensilsCrossed', 'ShoppingCart', 'Home', 'Car', 'Bus', 'Fuel', 'PartyPopper',
  'Gamepad2', 'Clapperboard', 'Music', 'HeartPulse', 'Pill', 'Dumbbell',
  'GraduationCap', 'BookOpen', 'Repeat', 'Wifi', 'Zap', 'Droplets', 'Phone',
  'TrendingUp', 'PiggyBank', 'Wallet', 'Briefcase', 'Gift', 'Plane', 'Shirt',
  'Baby', 'PawPrint', 'Wrench', 'Shapes'
]

export const ACCOUNT_ICONS = [
  'Wallet', 'Landmark', 'PiggyBank', 'CreditCard', 'Banknote', 'Coins',
  'TrendingUp', 'Briefcase', 'Smartphone', 'Building2'
]

export const GOAL_ICONS = [
  'Target', 'Laptop', 'Plane', 'Car', 'Home', 'Shield', 'Camera', 'Smartphone',
  'GraduationCap', 'Gift', 'Heart', 'Rocket', 'Gem', 'Bike'
]

/** Palette shared by accounts, cards, categories and goals. */
export const FINANCE_COLORS = [
  '250 82% 68%',
  '270 80% 66%',
  '300 70% 65%',
  '350 80% 62%',
  '25 90% 60%',
  '45 90% 58%',
  '152 62% 47%',
  '170 70% 50%',
  '190 85% 55%',
  '210 80% 62%',
  '240 8% 60%'
]

export function emptyFinanceData(): FinanceData {
  return {
    accounts: [],
    cards: [],
    categories: SEED_CATEGORIES.map((c) => ({ ...c, archived: false })),
    transactions: [],
    recurring: [],
    goals: [],
    budgets: [],
    settings: { ...DEFAULT_FINANCE_SETTINGS }
  }
}
