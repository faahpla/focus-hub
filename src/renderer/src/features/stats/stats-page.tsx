import { useMemo } from 'react'
import { Clock, Flame, Timer, Trophy, TrendingUp, Award, Lock } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/progress-bar'
import { DynamicIcon } from '@/components/dynamic-icon'
import { Heatmap } from './heatmap'
import { useAppStore } from '@/stores/app-store'
import { formatDuration, formatHours } from '@/lib/format'
import { XP_PER_LEVEL } from '@shared/types'
import { cn } from '@/lib/utils'

export function StatsPage(): JSX.Element {
  const stats = useAppStore((s) => s.stats)

  const { weekSeconds, monthSeconds, avgSeconds } = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
    const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
    let week = 0
    let month = 0
    for (const d of stats.days) {
      if (d.date >= weekAgo) week += d.focusedSeconds
      if (d.date >= monthAgo) month += d.focusedSeconds
    }
    const avg = stats.totalSessions > 0 ? stats.totalFocusedSeconds / stats.totalSessions : 0
    return { weekSeconds: week, monthSeconds: month, avgSeconds: avg }
  }, [stats])

  const xpInLevel = stats.xp % XP_PER_LEVEL
  const unlocked = stats.achievements.filter((a) => a.unlockedAt).length

  return (
    <div>
      <PageHeader title="Estatísticas" subtitle="Seu progresso, em números." />

      <div className="space-y-6 px-8 pb-24">
        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric icon={<Timer />} label="Total" value={`${formatHours(stats.totalFocusedSeconds)}h`} accent />
          <Metric icon={<TrendingUp />} label="Semana" value={formatDuration(weekSeconds)} />
          <Metric icon={<Clock />} label="Mês" value={formatDuration(monthSeconds)} />
          <Metric icon={<Timer />} label="Média/sessão" value={formatDuration(avgSeconds)} />
          <Metric icon={<Trophy />} label="Maior sessão" value={formatDuration(stats.longestSessionSeconds)} />
          <Metric icon={<Flame />} label="Sequência" value={`${stats.streakDays} dias`} />
        </div>

        {/* XP / Level */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-lg font-bold text-primary">
                {stats.level}
              </div>
              <div>
                <p className="text-sm font-semibold">Nível {stats.level}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.xp} XP · {stats.totalSessions} sessões
                </p>
              </div>
            </div>
            <span className="text-xs tabular text-muted-foreground">
              {xpInLevel}/{XP_PER_LEVEL} XP
            </span>
          </div>
          <ProgressBar value={xpInLevel / XP_PER_LEVEL} />
        </Card>

        {/* Heatmap */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Calendário de produtividade</h3>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              menos
              <span className="h-3 w-3 rounded-[3px] bg-muted/40" />
              <span className="h-3 w-3 rounded-[3px] bg-primary/45" />
              <span className="h-3 w-3 rounded-[3px] bg-primary" />
              mais
            </div>
          </div>
          <Heatmap days={stats.days} />
        </Card>

        {/* Achievements */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Conquistas</h3>
            <span className="text-xs text-muted-foreground">
              {unlocked}/{stats.achievements.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {stats.achievements.map((a) => {
              const isUnlocked = Boolean(a.unlockedAt)
              return (
                <div
                  key={a.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 transition-colors',
                    isUnlocked
                      ? 'border-primary/25 bg-primary/10'
                      : 'border-border/60 bg-surface/40 opacity-70'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      isUnlocked ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isUnlocked ? (
                      <DynamicIcon name={a.icon} className="h-4 w-4" />
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{a.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{a.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
  accent
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: boolean
}): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-surface/60 p-4',
        accent && 'border-primary/20 bg-primary/10'
      )}
    >
      <div className={cn('mb-2 flex h-7 w-7 items-center justify-center rounded-lg', accent ? 'bg-primary/20 text-primary' : 'bg-surface-elevated text-muted-foreground')}>
        <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      </div>
      <div className="text-lg font-semibold tabular">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
