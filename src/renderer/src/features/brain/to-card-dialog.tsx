import { useMemo, useState } from 'react'
import { KanbanSquare } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { useBoardsUiStore } from '@/stores/boards-ui-store'
import { useNavigatorStore } from '@/stores/navigator-store'
import { useToastStore } from '@/stores/toast-store'
import { canOnBoard } from '@/features/boards/board-templates'
import { cn, uid } from '@/lib/utils'
import type { BrainNote } from '@shared/types'

/**
 * Turn a note into a card: pick the board and the column, and the note's
 * text becomes the card's script. The note keeps a link to the card — the
 * idea and the video it became stay one click apart.
 */
export function ToCardDialog({ note, onClose }: { note: BrainNote; onClose: () => void }): JSX.Element {
  const boards = useAppStore((s) => s.boards)
  const cards = useAppStore((s) => s.cards)
  const saveCard = useAppStore((s) => s.saveCard)
  const saveBrainNotes = useAppStore((s) => s.saveBrainNotes)
  const lastBoardId = useBoardsUiStore((s) => s.selectedId)
  const openCard = useNavigatorStore((s) => s.openCard)
  const push = useToastStore((s) => s.push)

  // Boards this PC may add cards to; the one last opened first.
  const options = useMemo(
    () =>
      boards
        .filter((b) => canOnBoard(b, 'createCards') && b.columns.length > 0)
        .sort((a, b) => Number(b.id === lastBoardId) - Number(a.id === lastBoardId)),
    [boards, lastBoardId]
  )
  const [boardId, setBoardId] = useState(options[0]?.id)
  const board = options.find((b) => b.id === boardId)
  const columns = useMemo(
    () => (board ? [...board.columns].sort((a, b) => a.order - b.order) : []),
    [board]
  )
  // A new idea belongs in the first column still in progress.
  const [columnId, setColumnId] = useState<string | undefined>()
  const column =
    columns.find((c) => c.id === columnId) ?? columns.find((c) => !c.done && !c.cancelled) ?? columns[0]

  const create = async (): Promise<void> => {
    if (!board || !column) return
    const stamp = new Date().toISOString()
    const id = uid()
    await saveCard({
      id,
      boardId: board.id,
      columnId: column.id,
      title: note.title.trim() || 'Sem título',
      notes: note.body,
      tags: [],
      assets: [],
      createdAt: stamp,
      updatedAt: stamp,
      order: cards.filter((c) => c.columnId === column.id).length
    })
    await saveBrainNotes([{ ...note, cardId: id, inbox: false, updatedAt: stamp }])
    onClose()
    push({
      title: `Virou card em ${board.name}`,
      lines: [`Na coluna ${column.name}, com o texto da nota como roteiro.`],
      hint: 'Clique para abrir o card',
      onClick: () => openCard(id),
      variant: 'success',
      duration: 8000
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Virar card</DialogTitle>
          <DialogDescription>
            “{note.title || 'Sem título'}” vai para o quadro como um card novo, com o texto da nota
            no roteiro.
          </DialogDescription>
        </DialogHeader>

        {options.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Nenhum quadro onde você possa criar cards.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Quadro</p>
              <div className="flex flex-wrap gap-1.5">
                {options.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setBoardId(b.id)
                      setColumnId(undefined)
                    }}
                    className={cn(
                      'no-drag flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors',
                      b.id === board?.id
                        ? 'border-primary/50 bg-primary/15 text-foreground'
                        : 'border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                    )}
                  >
                    <KanbanSquare className="h-3.5 w-3.5" style={{ color: `hsl(${b.color})` }} />
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Coluna</p>
              <div className="flex flex-wrap gap-1.5">
                {columns.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setColumnId(c.id)}
                    className={cn(
                      'no-drag flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors',
                      c.id === column?.id
                        ? 'border-primary/50 bg-primary/15 text-foreground'
                        : 'border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                    )}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${c.color})` }} />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void create()} disabled={!board || !column}>
            Criar card
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
