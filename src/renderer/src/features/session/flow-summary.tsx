import { useEffect, useMemo, useState } from 'react'
import { BellOff, Ban, FolderOpen, Rocket, ShieldAlert, Sparkles, XCircle } from 'lucide-react'
import type { Project } from '@shared/types'
import { flowIsEmpty, mergeFlow } from '@shared/flow'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'

/**
 * Compact preview of what Flow mode will do to the machine when a session
 * starts. Reads the global Flow merged with the selected project's, so it
 * shows up even when no project is chosen — the case where Flow used to look
 * broken because it silently did nothing.
 */
export function FlowSummary({ project }: { project?: Project | null }): JSX.Element | null {
  const [info, setInfo] = useState<{ elevated: boolean; isPackaged: boolean } | null>(null)
  const globalFlow = useAppStore((s) => s.settings.flow)
  const flow = useMemo(() => mergeFlow(globalFlow, project?.flow), [globalFlow, project])

  useEffect(() => {
    let alive = true
    window.focusHub.getAppInfo().then((v) => alive && setInfo(v))
    return () => {
      alive = false
    }
  }, [])

  const elevated = info?.elevated ?? null
  const chips: { icon: React.ElementType; label: string; warn?: boolean }[] = []
  if (flow.closeApps.length) chips.push({ icon: XCircle, label: `${flow.closeApps.length} fecham` })
  if (flow.launchApps.length) chips.push({ icon: Rocket, label: `${flow.launchApps.length} abrem` })
  if (flow.openResources.length)
    chips.push({ icon: FolderOpen, label: `${flow.openResources.length} recursos` })
  if (flow.blockSites.length)
    chips.push({
      icon: Ban,
      label: `${flow.blockSites.length} sites`,
      warn: elevated === false
    })
  if (flow.doNotDisturb) chips.push({ icon: BellOff, label: 'Não perturbe' })
  if (flow.ultraFocus) chips.push({ icon: Sparkles, label: 'Ultra Focus' })

  if (flowIsEmpty(flow) || chips.length === 0) return null
  const needsAdmin = flow.blockSites.length > 0 && elevated === false

  return (
    <div className="mt-6 flex max-w-lg flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
          Ao iniciar
        </span>
        {chips.map((c, i) => (
          <span
            key={i}
            className={cn(
              'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
              c.warn
                ? 'border-orange-500/30 bg-orange-500/10 text-orange-400'
                : 'border-border/70 bg-surface/50 text-muted-foreground'
            )}
          >
            <c.icon className="h-3 w-3" />
            {c.label}
          </span>
        ))}
      </div>
      {needsAdmin && (
        <div className="flex items-center gap-1.5 text-[11px] text-orange-400/90">
          <ShieldAlert className="h-3 w-3 shrink-0" />
          <span>O bloqueio de sites precisa de administrador.</span>
          {info?.isPackaged && (
            <button
              onClick={() => window.focusHub.relaunchElevated()}
              className="no-drag rounded-md border border-orange-500/40 px-1.5 py-0.5 font-medium transition-colors hover:bg-orange-500/15"
            >
              Reiniciar como admin
            </button>
          )}
        </div>
      )}
    </div>
  )
}
