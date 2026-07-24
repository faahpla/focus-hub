import { useEffect, useState } from 'react'
import { BellOff, Ban, FolderOpen, Rocket, ShieldAlert, Sparkles, XCircle } from 'lucide-react'
import type { Project } from '@shared/types'
import { cn } from '@/lib/utils'

/** Compact preview of what Flow mode will do to the machine when a session starts. */
export function FlowSummary({ project }: { project: Project }): JSX.Element | null {
  const [elevated, setElevated] = useState<boolean | null>(null)
  const { flow } = project

  useEffect(() => {
    let alive = true
    window.focusHub.isElevated().then((v) => alive && setElevated(v))
    return () => {
      alive = false
    }
  }, [])

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

  if (chips.length === 0) return null
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
        <p className="flex items-center gap-1.5 text-[11px] text-orange-400/90">
          <ShieldAlert className="h-3 w-3" />
          Para bloquear sites, abra o Focus HUB como administrador.
        </p>
      )}
    </div>
  )
}
