import { AlertTriangle, ExternalLink, MoreHorizontal, RefreshCw, Unplug } from 'lucide-react'
import type { ChannelAccount, DailyPoint } from '@shared/channels'
import type { Board } from '@shared/types'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { PlatformMark } from './platform-mark'
import { fmtAgo, fmtCompact, fmtMoney, fmtSeconds } from './channel-utils'

/** One account on one platform: its numbers over the last 28 days. */
export function AccountTile({
  account,
  boards,
  syncing
}: {
  account: ChannelAccount
  boards: Board[]
  syncing: boolean
}): JSX.Element {
  const p = account.period
  const net =
    p?.followersGained !== undefined ? p.followersGained - (p.followersLost ?? 0) : undefined
  const profileUrl =
    account.platform === 'youtube'
      ? `https://www.youtube.com/channel/${account.externalId}`
      : undefined

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          {account.avatarUrl ? (
            <img src={account.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-surface-elevated" />
          )}
          <span className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5">
            <PlatformMark platform={account.platform} className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{account.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {fmtCompact(account.followers)} seguidores · {fmtCompact(account.videoCount)} vídeos
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="no-drag rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              aria-label="Opções da conta"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem
              disabled={syncing}
              onSelect={() => void window.focusHub.refreshChannels(account.id)}
            >
              <RefreshCw className="h-4 w-4" /> Atualizar agora
            </DropdownMenuItem>
            {profileUrl && (
              <DropdownMenuItem onSelect={() => window.open(profileUrl, '_blank')}>
                <ExternalLink className="h-4 w-4" /> Abrir o canal
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Canal (quadro)</DropdownMenuLabel>
            {boards.map((b) => (
              <DropdownMenuItem
                key={b.id}
                active={account.boardId === b.id}
                onSelect={() => void window.focusHub.setChannelBoard(account.id, b.id)}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${b.color})` }} />
                {b.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              active={!account.boardId}
              onSelect={() => void window.focusHub.setChannelBoard(account.id, null)}
            >
              Nenhum
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              // Nothing changes on the platform: reconnecting brings it all back.
              onSelect={() => void window.focusHub.disconnectChannel(account.id)}
            >
              <Unplug className="h-4 w-4" /> Desconectar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {p ? (
        <>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Views · {p.days} dias
              </p>
              <p className="text-2xl font-semibold tabular">{fmtCompact(p.views)}</p>
            </div>
            <Sparkline points={p.daily} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <Stat
              label="Seguidores"
              value={net === undefined ? '—' : `${net >= 0 ? '+' : ''}${fmtCompact(net)}`}
              tone={net === undefined ? undefined : net >= 0 ? 'up' : 'down'}
            />
            <Stat
              label="Horas vistas"
              value={
                p.watchMinutes === undefined ? '—' : fmtCompact(Math.round(p.watchMinutes / 60))
              }
            />
            <Stat label="Média/view" value={fmtSeconds(p.avgViewDurationSec)} />
            <Stat label="Curtidas" value={fmtCompact(p.likes)} />
            <Stat label="Compart." value={fmtCompact(p.shares)} />
            <Stat
              label="Receita"
              value={p.revenue === null ? 'sem receita' : fmtMoney(p.revenue)}
              muted={p.revenue === null}
            />
          </div>
        </>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          {syncing ? 'Buscando os números…' : 'Ainda sem números.'}
        </p>
      )}

      <div className="mt-auto pt-3">
        {account.lastError ? (
          <p className="flex items-start gap-1.5 text-[11px] text-warning">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0" /> {account.lastError}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <RefreshCw className={cn('h-3 w-3', syncing && 'animate-spin')} />
            {syncing ? 'Atualizando…' : `Atualizado ${fmtAgo(account.lastSyncAt)}`}
          </p>
        )}
      </div>
    </Card>
  )
}

function Stat({
  label,
  value,
  tone,
  muted
}: {
  label: string
  value: string
  tone?: 'up' | 'down'
  muted?: boolean
}): JSX.Element {
  return (
    <div className="rounded-lg bg-surface-elevated/60 px-2 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'truncate font-medium tabular',
          tone === 'up' && 'text-success',
          tone === 'down' && 'text-destructive',
          muted && 'text-muted-foreground'
        )}
      >
        {value}
      </p>
    </div>
  )
}

/** Daily views as a small line — the shape of the month, not exact values. */
function Sparkline({ points }: { points: DailyPoint[] }): JSX.Element | null {
  if (points.length < 2) return null
  const w = 120
  const h = 36
  const max = Math.max(1, ...points.map((p) => p.views))
  const xy = points.map(
    (p, i) => [(i / (points.length - 1)) * w, h - 2 - (p.views / max) * (h - 4)] as const
  )
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 text-primary">
      <path d={`${line}L${w},${h}L0,${h}Z`} fill="currentColor" opacity={0.12} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}
