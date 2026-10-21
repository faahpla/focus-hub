import { useAppStore } from '@/stores/app-store'
import { useNavigatorStore } from '@/stores/navigator-store'
import { CardDetailDialog } from './card-detail-dialog'

/** The card opened from outside its board — by the search or the home screen. */
export function CardDialogHost(): JSX.Element | null {
  const openCardId = useNavigatorStore((s) => s.openCardId)
  const openCard = useNavigatorStore((s) => s.openCard)
  const card = useAppStore((s) => s.cards.find((c) => c.id === openCardId))
  const board = useAppStore((s) => s.boards.find((b) => b.id === card?.boardId))
  if (!card || !board) return null
  return (
    <CardDetailDialog
      // Remount per card so the autosaved fields reseed from the new card.
      key={card.id}
      cardId={card.id}
      board={board}
      onClose={() => openCard(null)}
    />
  )
}
