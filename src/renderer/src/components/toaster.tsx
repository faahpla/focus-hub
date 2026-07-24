import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useToastStore, type ToastVariant } from '@/stores/toast-store'
import { cn } from '@/lib/utils'

const ICONS: Record<ToastVariant, React.ElementType> = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: AlertTriangle
}

const ACCENT: Record<ToastVariant, string> = {
  default: 'text-muted-foreground',
  success: 'text-success',
  warning: 'text-orange-400',
  destructive: 'text-destructive'
}

export function Toaster(): JSX.Element {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="pointer-events-none absolute right-4 top-12 z-[120] flex w-80 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.variant]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="pointer-events-auto overflow-hidden rounded-2xl border border-border/80 bg-surface-elevated/95 p-3.5 shadow-elevated backdrop-blur-xl"
            >
              <div className="flex items-start gap-2.5">
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ACCENT[t.variant])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t.title}</p>
                  {t.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                  )}
                  {t.lines && t.lines.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {t.lines.map((line, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 rounded-md p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
