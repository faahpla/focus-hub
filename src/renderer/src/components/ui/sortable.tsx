import { createContext, useContext } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HandleCtx {
  attributes: DraggableAttributes
  listeners: ReturnType<typeof useSortable>['listeners']
}
const HandleContext = createContext<HandleCtx | null>(null)

/**
 * Vertical sortable list. Give it the current ordered ids and an onReorder
 * callback; it hands back the reordered ids after a drag. Render `SortableItem`
 * children keyed by id, and place a `DragHandle` inside each one.
 */
export function SortableList({
  ids,
  onReorder,
  children
}: {
  ids: string[]
  onReorder: (ids: string[]) => void
  children: React.ReactNode
}): JSX.Element {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const onDragEnd = (e: DragEndEvent): void => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(active.id as string)
    const newIndex = ids.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay />
    </DndContext>
  )
}

export function SortableItem({
  id,
  className,
  children
}: {
  id: string
  className?: string
  children: React.ReactNode
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id
  })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined
      }}
      className={className}
    >
      <HandleContext.Provider value={{ attributes, listeners }}>
        {children}
      </HandleContext.Provider>
    </div>
  )
}

/** Drag grip. Must be rendered inside a `SortableItem`. */
export function DragHandle({ className }: { className?: string }): JSX.Element {
  const ctx = useContext(HandleContext)
  return (
    <button
      {...(ctx?.attributes ?? {})}
      {...(ctx?.listeners ?? {})}
      className={cn(
        'flex cursor-grab touch-none items-center text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing',
        className
      )}
      aria-label="Reordenar"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  )
}
