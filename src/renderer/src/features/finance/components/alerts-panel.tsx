import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, ChevronDown } from 'lucide-react'
import { DynamicIcon } from '@/components/dynamic-icon'
import { useFinanceUi, type FinanceTab } from '@/stores/finance-ui-store'
import { cn } from '@/lib/utils'
import { useAlerts } from '../hooks/use-finance'
import type { AlertSeverity } from '../services/alerts-service'

const TONE: Record<AlertSeverity, string> = {
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
  warning: 'border-[hsl(45_90%_58%/0.3)] bg-[hsl(45_90%_58%/0.1)] text-[hsl(45_90%_58%)]',
  success: 'border-success/30 bg-success/10 text-success',
  info: 'border-border/70 bg-surface/50 text-muted-foreground'
}

const COLLAPSED = 3

/**
 * What needs attention today. Collapsed to the three most urgent items so a
 * busy month doesn't push the whole dashboard off the screen.
 */
export function AlertsPanel(): JSX.Element | null {
  const alerts = useAlerts()
  const setTab = useFinanceUi((s) => s.setTab)
  const [expanded, setExpanded] = useState(false)

  if (alerts.length === 0) return null
  const shown = expanded ? alerts : alerts.slice(0, COLLAPSED)

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Bell className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-muted-foreground">
          Alertas ({alerts.length})
        </h3>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence initial={false}>
          {shown.map((alert) => (
            <motion.button
              key={alert.id}
              layout
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              onClick={() =>
                alert.target && setTab(alert.target.tab as FinanceTab, alert.target.id)
              }
              className={cn(
                'no-drag flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors hover:brightness-110',
                TONE[alert.severity]
              )}
            >
              <DynamicIcon name={alert.icon} className="mt-px h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-foreground">
                  {alert.title}
                </span>
                <span className="block truncate text-[11px]">{alert.detail}</span>
              </span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {alerts.length > COLLAPSED && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="no-drag mt-2 flex items-center gap-1 px-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
          {expanded ? 'Mostrar menos' : `Mais ${alerts.length - COLLAPSED}`}
        </button>
      )}
    </div>
  )
}
