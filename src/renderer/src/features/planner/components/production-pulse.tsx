import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Layers } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { useBoardsUiStore } from '@/stores/boards-ui-store'
import { isCardOpen } from '@/features/boards/card-flow'

/**
 * How much is in each stage of every board, at a glance: "Roteiros 4 ·
 * Edição 2". Finished and dropped columns are left out — this is about what
 * is still moving. A click opens that board.
 */
export function ProductionPulse(): JSX.Element | null {
  const navigate = useNavigate()
  const cards = useAppStore((s) => s.cards)
  const boards = useAppStore((s) => s.boards)
  const select = useBoardsUiStore((s) => s.select)

  const rows = useMemo(
    () =>
      boards
        .map((board) => {
          const open = cards.filter((c) => c.boardId === board.id && isCardOpen(c, board))
          const stages = [...board.columns]
            .sort((a, b) => a.order - b.order)
            .filter((col) => !col.done && !col.cancelled)
            .map((col) => ({ col, count: open.filter((c) => c.columnId === col.id).length }))
            .filter((s) => s.count > 0)
          return { board, total: open.length, stages }
        })
        .filter((r) => r.total > 0)
        .sort((a, b) => b.total - a.total),
    [cards, boards]
  )

  if (rows.length === 0) return null

  return (
    <div className="rounded-2xl border border-border/70 bg-surface/50 p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <Layers className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">Em produção</span>
      </div>
      <div className="space-y-1">
        {rows.map(({ board, total, stages }) => (
          <button
            key={board.id}
            onClick={() => {
              select(board.id)
              navigate('/boards')
            }}
            className="no-drag group block w-full rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-surface-hover"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: `hsl(${board.color})` }} />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{board.name}</span>
              <span className="text-[11px] tabular text-muted-foreground">{total}</span>
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-0.5 truncate pl-4 text-[11px] text-muted-foreground">
              {stages.map((s) => `${s.col.name} ${s.count}`).join(' · ')}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
