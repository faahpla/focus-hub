import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  Gauge,
  Landmark,
  LayoutDashboard,
  Layers,
  ListOrdered,
  PieChart,
  Repeat,
  Settings2,
  Target
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useAppStore } from '@/stores/app-store'
import { useFinanceUi, type FinanceTab } from '@/stores/finance-ui-store'
import { cn } from '@/lib/utils'
import { PinLock, PinSettings } from './components/pin-lock'
import { DashboardPage } from './pages/dashboard-page'
import { TransactionsPage } from './pages/transactions-page'
import { AccountsPage } from './pages/accounts-page'
import { CardsPage } from './pages/cards-page'
import { InstallmentsPage } from './pages/installments-page'
import { RecurringPage } from './pages/recurring-page'
import { GoalsPage } from './pages/goals-page'
import { BudgetPage } from './pages/budget-page'
import { CalendarPage } from './pages/calendar-page'
import { ReportsPage } from './pages/reports-page'
import { useRecurringGeneration } from './hooks/use-finance'
import { currentMonth, monthLabel } from '@/lib/dates'

const TABS: { id: FinanceTab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transações', icon: ListOrdered },
  { id: 'accounts', label: 'Contas', icon: Landmark },
  { id: 'cards', label: 'Cartões', icon: CreditCard },
  { id: 'installments', label: 'Parcelas', icon: Layers },
  { id: 'recurring', label: 'Fixas', icon: Repeat },
  { id: 'goals', label: 'Metas', icon: Target },
  { id: 'budget', label: 'Orçamento', icon: Gauge },
  { id: 'calendar', label: 'Calendário', icon: CalendarDays },
  { id: 'reports', label: 'Relatórios', icon: PieChart }
]

/** Tabs whose content is tied to the selected month. */
const MONTH_AWARE: FinanceTab[] = ['dashboard', 'budget', 'calendar', 'reports']

const PAGES: Record<FinanceTab, () => JSX.Element> = {
  dashboard: DashboardPage,
  transactions: TransactionsPage,
  accounts: AccountsPage,
  cards: CardsPage,
  installments: InstallmentsPage,
  recurring: RecurringPage,
  goals: GoalsPage,
  budget: BudgetPage,
  calendar: CalendarPage,
  reports: ReportsPage
}

export function FinancePage(): JSX.Element {
  const settings = useAppStore((s) => s.finance.settings)
  const saveFinanceSettings = useAppStore((s) => s.saveFinanceSettings)
  const { tab, setTab, month, stepMonth, setMonth, unlocked, unlock } = useFinanceUi()
  const [showSettings, setShowSettings] = useState(false)

  useRecurringGeneration()

  // A PIN that is set but not entered gates the whole module.
  const locked = Boolean(settings.pinHash) && settings.lockOnOpen && !unlocked

  // Coming back to a month-agnostic tab shouldn't strand the user in the past.
  useEffect(() => {
    if (!MONTH_AWARE.includes(tab) && month !== currentMonth()) setMonth(currentMonth())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  if (locked) return <PinLock onUnlock={unlock} />

  const Page = PAGES[tab]
  const showMonthNav = MONTH_AWARE.includes(tab)

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-8 pb-4 pt-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finance HUB</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seu dinheiro no mesmo lugar que o seu foco.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {showMonthNav && (
            <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-surface/50 p-1">
              <Button size="sm" variant="ghost" className="px-2" onClick={() => stepMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <button
                onClick={() => setMonth(currentMonth())}
                className={cn(
                  'no-drag min-w-[6.5rem] rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                  month === currentMonth()
                    ? 'text-foreground'
                    : 'text-primary hover:bg-surface-hover'
                )}
                title={month === currentMonth() ? 'Mês atual' : 'Voltar para o mês atual'}
              >
                {monthLabel(month)}
              </button>
              <Button size="sm" variant="ghost" className="px-2" onClick={() => stepMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            title={settings.hideValues ? 'Mostrar valores' : 'Ocultar valores'}
            onClick={() => void saveFinanceSettings({ hideValues: !settings.hideValues })}
          >
            {settings.hideValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} title="Ajustes">
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 overflow-x-auto scrollbar-thin px-8 pb-4">
        {TABS.map((item) => {
          const active = tab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                'no-drag relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {active && (
                <motion.span
                  layoutId="finance-tab"
                  className="absolute inset-0 rounded-xl border border-border/80 bg-surface-elevated"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <item.icon className="relative h-3.5 w-3.5" />
              <span className="relative">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Page />
          </motion.div>
        </AnimatePresence>
      </div>

      {showSettings && <FinanceSettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  )
}

function FinanceSettingsDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const settings = useAppStore((s) => s.finance.settings)
  const saveFinanceSettings = useAppStore((s) => s.saveFinanceSettings)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="mb-4">Ajustes do Finance HUB</DialogTitle>

        <div className="space-y-1">
          <Row
            title="Ocultar valores"
            description="Desfoca todo valor na tela — útil ao gravar ou compartilhar a tela."
          >
            <Switch
              checked={settings.hideValues}
              onCheckedChange={(hideValues) => void saveFinanceSettings({ hideValues })}
            />
          </Row>

          <Row
            title="Alertas"
            description="Contas vencendo, limite de cartão, orçamento estourado e metas."
          >
            <Switch
              checked={settings.alertsEnabled}
              onCheckedChange={(alertsEnabled) => void saveFinanceSettings({ alertsEnabled })}
            />
          </Row>

          <Row
            title="Avisar com antecedência"
            description="Quantos dias antes do vencimento o alerta aparece."
          >
            <div className="flex items-center gap-1">
              {[3, 5, 7, 10].map((days) => (
                <button
                  key={days}
                  onClick={() => void saveFinanceSettings({ dueSoonDays: days })}
                  className={cn(
                    'no-drag rounded-lg px-2.5 py-1 text-xs transition-colors',
                    settings.dueSoonDays === days
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-surface-hover'
                  )}
                >
                  {days}d
                </button>
              ))}
            </div>
          </Row>

          <Row
            title="Alerta de limite do cartão"
            description="A partir de quanto do limite usado o aviso dispara."
          >
            <div className="flex items-center gap-1">
              {[0.7, 0.8, 0.9].map((threshold) => (
                <button
                  key={threshold}
                  onClick={() => void saveFinanceSettings({ cardAlertThreshold: threshold })}
                  className={cn(
                    'no-drag rounded-lg px-2.5 py-1 text-xs transition-colors',
                    settings.cardAlertThreshold === threshold
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-surface-hover'
                  )}
                >
                  {threshold * 100}%
                </button>
              ))}
            </div>
          </Row>

          <Row
            title="Mostrar no Início"
            description="Um resumo financeiro no painel principal do Focus HUB."
          >
            <Switch
              checked={settings.showOnHome}
              onCheckedChange={(showOnHome) => void saveFinanceSettings({ showOnHome })}
            />
          </Row>

          <Row
            title="PIN de acesso"
            description="Pede 4 dígitos ao abrir o Finance HUB. Protege de quem olha a tela — não é criptografia: o arquivo de dados continua legível no seu Windows."
          >
            <PinSettings />
          </Row>
        </div>

        <div className="mt-5 flex justify-end border-t border-border/60 pt-4">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({
  title,
  description,
  children
}: {
  title: string
  description: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl px-1 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
