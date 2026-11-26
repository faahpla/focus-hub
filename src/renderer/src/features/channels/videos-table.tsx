import { useMemo, useState } from 'react'
import { Link2, Search, X } from 'lucide-react'
import type { ChannelsState, Platform, PlatformVideo } from '@shared/channels'
import { PLATFORM_LABEL } from '@shared/channels'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { useAppStore } from '@/stores/app-store'
import { useNavigatorStore } from '@/stores/navigator-store'
import { cn } from '@/lib/utils'
import { searchable } from '../boards/card-flow'
import { CardPicker } from './card-picker'
import { PlatformMark } from './platform-mark'
import { fmtCompact, fmtDay, fmtMoney, linkedCard } from './channel-utils'

type Sort = 'recent' | 'views' | 'retention' | 'revenue'
type Format = 'all' | 'short' | 'long'

const PAGE = 60

/** Every published video, with its numbers and the card it came from. */
export function VideosTable({ state }: { state: ChannelsState }): JSX.Element {
  const cards = useAppStore((s) => s.cards)
  const boards = useAppStore((s) => s.boards)
  const openCard = useNavigatorStore((s) => s.openCard)
  const [board, setBoard] = useState<string>('all')
  const [platform, setPlatform] = useState<'all' | Platform>('all')
  const [format, setFormat] = useState<Format>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [picking, setPicking] = useState<PlatformVideo | null>(null)

  const accountOf = useMemo(() => new Map(state.accounts.map((a) => [a.id, a])), [state.accounts])
  const channelBoards = boards.filter((b) => state.accounts.some((a) => a.boardId === b.id))
  const platforms = [...new Set(state.accounts.map((a) => a.platform))]

  const rows = useMemo(() => {
    const q = searchable(query.trim())
    const list = state.videos.filter((v) => {
      const account = accountOf.get(v.accountId)
      if (board !== 'all' && account?.boardId !== board) return false
      if (platform !== 'all' && v.platform !== platform) return false
      if (format === 'short' && !v.probablyShort) return false
      if (format === 'long' && v.probablyShort !== false) return false
      return !q || searchable(v.title).includes(q)
    })
    const by: Record<Sort, (a: PlatformVideo, b: PlatformVideo) => number> = {
      recent: (a, b) => b.publishedAt.localeCompare(a.publishedAt),
      views: (a, b) => b.views - a.views,
      retention: (a, b) => (b.avgViewPercentage ?? -1) - (a.avgViewPercentage ?? -1),
      revenue: (a, b) => (b.revenue ?? -1) - (a.revenue ?? -1)
    }
    return list.sort(by[sort])
  }, [state.videos, accountOf, board, platform, format, sort, query])

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-semibold">
          Vídeos <span className="font-normal text-muted-foreground">{rows.length}</span>
        </h3>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar título…"
            className="no-drag h-9 w-48 rounded-lg border border-input bg-surface/60 pl-9 pr-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
          />
        </div>
        {channelBoards.length > 1 && (
          <Select
            className="h-9 w-36"
            value={board}
            onChange={setBoard}
            options={[
              { value: 'all', label: 'Todos os canais' },
              ...channelBoards.map((b) => ({ value: b.id, label: b.name }))
            ]}
          />
        )}
        {platforms.length > 1 && (
          <Select
            className="h-9 w-36"
            value={platform}
            onChange={setPlatform}
            options={[
              { value: 'all' as const, label: 'Todas as redes' },
              ...platforms.map((p) => ({ value: p, label: PLATFORM_LABEL[p] }))
            ]}
          />
        )}
        <Select
          className="h-9 w-32"
          value={format}
          onChange={setFormat}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'short', label: 'Shorts' },
            { value: 'long', label: 'Longos' }
          ]}
        />
        <Select
          className="h-9 w-40"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'recent', label: 'Mais recentes' },
            { value: 'views', label: 'Mais vistos' },
            { value: 'retention', label: 'Melhor retenção' },
            { value: 'revenue', label: 'Maior receita' }
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum vídeo com esse filtro.
        </p>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Vídeo</th>
                <Num>Views</Num>
                <Num>Curtidas</Num>
                <Num>Coment.</Num>
                <Num>Compart.</Num>
                <Num title="Quanto do vídeo a view média assistiu">Retenção</Num>
                <Num>Receita</Num>
                <th className="pb-2 pl-4 font-medium">Card</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((v) => {
                const { card, auto } = linkedCard(v, state, cards)
                return (
                  <tr key={v.id} className="border-t border-border/50 align-middle">
                    <td className="py-2 pr-3">
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noreferrer"
                        className="no-drag group flex min-w-[280px] items-center gap-3"
                      >
                        <div className="relative shrink-0">
                          {v.thumbnailUrl ? (
                            <img
                              src={v.thumbnailUrl}
                              alt=""
                              className="h-10 w-[72px] rounded-md object-cover"
                            />
                          ) : (
                            <div className="h-10 w-[72px] rounded-md bg-surface-elevated" />
                          )}
                          <span className="absolute bottom-0.5 left-0.5 rounded bg-background/80 p-0.5">
                            <PlatformMark platform={v.platform} className="h-3 w-3" />
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-1 font-medium group-hover:underline">
                            {v.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {fmtDay(v.publishedAt)}
                            {v.probablyShort !== undefined && (
                              <> · {v.probablyShort ? 'Short' : 'Longo'}</>
                            )}
                          </p>
                        </div>
                      </a>
                    </td>
                    <Cell strong>{fmtCompact(v.views)}</Cell>
                    <Cell>{fmtCompact(v.likes)}</Cell>
                    <Cell>{fmtCompact(v.comments)}</Cell>
                    <Cell>{fmtCompact(v.shares)}</Cell>
                    <Cell>
                      {v.avgViewPercentage === undefined
                        ? '—'
                        : `${Math.round(v.avgViewPercentage)}%`}
                    </Cell>
                    <Cell>{fmtMoney(v.revenue)}</Cell>
                    <td className="py-2 pl-4">
                      {card ? (
                        <span className="flex max-w-[220px] items-center gap-1">
                          <button
                            onClick={() => openCard(card.id)}
                            title={auto ? 'Ligado automaticamente pelo título' : 'Ligado por você'}
                            className={cn(
                              'no-drag truncate rounded-md px-2 py-0.5 text-xs transition-colors hover:bg-surface-hover',
                              auto
                                ? 'border border-dashed border-border'
                                : 'bg-primary/15 text-foreground'
                            )}
                          >
                            {card.title}
                          </button>
                          <button
                            onClick={() => void window.focusHub.linkVideo(v.id, null)}
                            title="Não é este card"
                            className="no-drag rounded p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setPicking(v)}
                          className="no-drag flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                        >
                          <Link2 className="h-3 w-3" /> Ligar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > limit && (
        <button
          onClick={() => setLimit((l) => l + PAGE)}
          className="no-drag mt-3 w-full rounded-lg py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          Mostrar mais {Math.min(PAGE, rows.length - limit)}
        </button>
      )}
      {picking && (
        <CardPicker
          video={picking}
          boardId={accountOf.get(picking.accountId)?.boardId}
          onClose={() => setPicking(null)}
        />
      )}
    </Card>
  )
}

function Num({ children, title }: { children: React.ReactNode; title?: string }): JSX.Element {
  return (
    <th className="pb-2 pl-3 text-right font-medium" title={title}>
      {children}
    </th>
  )
}

function Cell({ children, strong }: { children: React.ReactNode; strong?: boolean }): JSX.Element {
  return (
    <td
      className={cn(
        'py-2 pl-3 text-right tabular',
        strong ? 'font-semibold' : 'text-muted-foreground'
      )}
    >
      {children}
    </td>
  )
}
