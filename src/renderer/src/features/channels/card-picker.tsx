import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import type { PlatformVideo } from '@shared/channels'
import { searchable } from '../boards/card-flow'

/** Pick the card a published video came from. The channel's own board comes first. */
export function CardPicker({
  video,
  boardId,
  onClose
}: {
  video: PlatformVideo
  boardId?: string
  onClose: () => void
}): JSX.Element {
  const cards = useAppStore((s) => s.cards)
  const boards = useAppStore((s) => s.boards)
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    const q = searchable(query.trim())
    return cards
      .filter((c) => !q || searchable(`${c.title} ${c.publishTitle ?? ''}`).includes(q))
      .sort(
        (a, b) =>
          Number(b.boardId === boardId) - Number(a.boardId === boardId) ||
          b.createdAt.localeCompare(a.createdAt)
      )
      .slice(0, 60)
  }, [cards, query, boardId])

  const pick = (cardId: string): void => {
    void window.focusHub.linkVideo(video.id, cardId)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[80vh] max-w-xl flex-col">
        <DialogHeader>
          <DialogTitle>Ligar a um card</DialogTitle>
          <DialogDescription className="line-clamp-2">{video.title}</DialogDescription>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar card pelo título…"
            className="no-drag h-9 w-full rounded-lg border border-input bg-surface/60 pl-9 pr-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
          />
        </div>
        <div className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1 scrollbar-thin">
          {shown.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum card com isso.</p>
          )}
          {shown.map((card) => {
            const board = boards.find((b) => b.id === card.boardId)
            return (
              <button
                key={card.id}
                onClick={() => pick(card.id)}
                className={cn(
                  'no-drag flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover'
                )}
              >
                {board && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: `hsl(${board.color})` }}
                    title={board.name}
                  />
                )}
                <span className="min-w-0 flex-1 truncate">{card.title}</span>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
