import { useMemo, useState } from 'react'
import { Check, Clapperboard, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { useNavigatorStore } from '@/stores/navigator-store'
import { relativeDayLabel, toDayKey } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { Board, BoardCard } from '@shared/types'
import { searchable } from './card-flow'
import { animeIndex, freeShorts, groupByAnime, newCompilation, wordCount } from './compilations'

/**
 * The shelf of shorts no TikTok has used yet, grouped by anime. Pick two or
 * three and they become a compilation — or, opened from a compilation, more
 * parts for it.
 */
export function CompilationShelf({
  board,
  compilation,
  onClose
}: {
  board: Board
  /** Adding to this compilation instead of creating a new one. */
  compilation?: BoardCard
  onClose: () => void
}): JSX.Element {
  const cards = useAppStore((s) => s.cards)
  const saveCard = useAppStore((s) => s.saveCard)
  const openCard = useNavigatorStore((s) => s.openCard)
  const [picked, setPicked] = useState<string[]>([])
  const [query, setQuery] = useState('')
  // One anime at a time, or all of them. Adding to a compilation starts on its own.
  const [anime, setAnime] = useState<string | null>(compilation?.tags[0] ?? null)

  // Which anime each short is about, learnt from this board's tags and titles.
  const animeOf = useMemo(
    () => animeIndex(cards.filter((c) => c.boardId === board.id)),
    [cards, board.id]
  )

  const groups = useMemo(() => {
    const q = searchable(query.trim())
    const shelf = freeShorts(board, cards).filter(
      (c) => !q || searchable(`${c.title} ${c.tags.join(' ')}`).includes(q)
    )
    return groupByAnime(shelf, animeOf)
  }, [board, cards, query, animeOf])

  // The chosen anime only — unless it has nothing left under this search.
  const narrowed = anime && groups.some((g) => g.anime === anime)
  const shown = narrowed ? groups.filter((g) => g.anime === anime) : groups

  const columnOf = (card: BoardCard) => board.columns.find((c) => c.id === card.columnId)
  const byId = new Map(cards.map((c) => [c.id, c]))
  const pickedCards = picked.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []))
  const mixed = new Set(pickedCards.map(animeOf)).size > 1

  const toggle = (id: string): void =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const confirm = async (): Promise<void> => {
    if (pickedCards.length === 0) return
    if (compilation) {
      const fresh = cards.find((c) => c.id === compilation.id) ?? compilation
      await saveCard({ ...fresh, parts: [...(fresh.parts ?? []), ...picked] })
      onClose()
      return
    }
    const created = newCompilation(board, pickedCards, cards)
    await saveCard(created)
    onClose()
    openCard(created.id)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[82vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-primary" />
            {compilation ? 'Adicionar partes' : 'Montar TikTok'}
          </DialogTitle>
          <DialogDescription>
            Curtos do {board.name} que ainda não entraram em nenhum TikTok, por anime. Marque na
            ordem em que vão tocar — dá para reordenar depois.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por título ou anime…"
            className="no-drag h-9 w-full rounded-lg border border-input bg-surface/60 pl-9 pr-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
          />
        </div>

        {/* Which anime: a click shows only that one, another click shows all. */}
        {groups.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            <AnimeChip
              label="Todos"
              count={groups.reduce((n, g) => n + g.cards.length, 0)}
              on={!narrowed}
              onClick={() => setAnime(null)}
            />
            {groups.map((g) => (
              <AnimeChip
                key={g.anime}
                label={g.anime}
                count={g.cards.length}
                on={narrowed === true && anime === g.anime}
                onClick={() => setAnime(anime === g.anime ? null : g.anime)}
              />
            ))}
          </div>
        )}

        <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1 scrollbar-thin">
          {groups.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {query
                ? 'Nada com esse filtro.'
                : 'Todos os curtos deste quadro já estão em algum TikTok.'}
            </p>
          )}
          {shown.map((group) => (
            <div key={group.anime}>
              <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                {group.anime}
                <span className="font-normal">{group.cards.length} livres</span>
              </p>
              <div className="space-y-1">
                {group.cards.map((card) => {
                  const order = picked.indexOf(card.id)
                  const column = columnOf(card)
                  return (
                    <button
                      key={card.id}
                      onClick={() => toggle(card.id)}
                      className={cn(
                        'no-drag flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                        order >= 0
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border/60 hover:bg-surface-hover'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold',
                          order >= 0
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border'
                        )}
                      >
                        {order >= 0 ? order + 1 : ''}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{card.title}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          {column && (
                            <span className="flex items-center gap-1">
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: `hsl(${column.color})` }}
                              />
                              {column.name}
                            </span>
                          )}
                          <span>· {wordCount(card.notes)} palavras</span>
                          <span>
                            · criado {relativeDayLabel(toDayKey(new Date(card.createdAt)))}
                          </span>
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <p className="text-xs text-muted-foreground">
            {picked.length === 0
              ? 'Escolha 2 ou 3 curtos.'
              : `${picked.length} escolhido${picked.length === 1 ? '' : 's'}${mixed ? ' · animes misturados' : ''}`}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void confirm()} disabled={picked.length === 0}>
              <Check className="h-4 w-4" />
              {compilation ? `Adicionar ${picked.length || ''}`.trim() : 'Criar compilado'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AnimeChip({
  label,
  count,
  on,
  onClick
}: {
  label: string
  count: number
  on: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'no-drag flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors',
        on
          ? 'border-primary/50 bg-primary/15 font-medium text-foreground'
          : 'border-border/70 text-muted-foreground hover:bg-surface-hover hover:text-foreground'
      )}
    >
      {label}
      <span className="text-[10px] tabular text-muted-foreground">{count}</span>
    </button>
  )
}
