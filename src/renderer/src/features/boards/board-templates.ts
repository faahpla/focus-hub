import type { Board, BoardCard, BoardColumn } from '@shared/types'
import { uid } from '@/lib/utils'

/**
 * A card counts as finished when it was ticked by hand, or simply because it
 * sits in a column the user marked as the finish line. Lives here (a leaf
 * module) so both the board and the card dialog can use it without a cycle.
 */
export function isCardDone(card: BoardCard, columns: BoardColumn[]): boolean {
  if (card.done !== undefined) return card.done
  return columns.find((c) => c.id === card.columnId)?.done === true
}

/** Palette used for new columns, cycled in order. */
export const COLUMN_COLORS = [
  '250 82% 68%',
  '199 89% 60%',
  '160 70% 48%',
  '38 92% 58%',
  '340 75% 62%',
  '280 70% 66%'
] as const

export interface BoardTemplate {
  id: string
  name: string
  description: string
  icon: string
  color: string
  columns: string[]
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'content',
    name: 'Criador de conteúdo',
    description: 'Ideia → Roteiro → Gravação → Edição → Publicado',
    icon: 'Clapperboard',
    color: '270 80% 66%',
    columns: ['Ideia', 'Roteiro', 'Gravação', 'Edição', 'Publicado']
  },
  {
    id: 'simple',
    name: 'Simples',
    description: 'A fazer → Fazendo → Concluído',
    icon: 'KanbanSquare',
    color: '199 89% 60%',
    columns: ['A fazer', 'Fazendo', 'Concluído']
  },
  {
    id: 'blank',
    name: 'Em branco',
    description: 'Comece com uma coluna só e monte do seu jeito',
    icon: 'LayoutGrid',
    color: '160 70% 48%',
    columns: ['Backlog']
  }
]

export function makeColumn(name: string, order: number, done = false): BoardColumn {
  return {
    id: uid(),
    name,
    color: COLUMN_COLORS[order % COLUMN_COLORS.length],
    order,
    ...(done ? { done: true } : {})
  }
}

export function makeBoard(
  template: BoardTemplate,
  overrides: Partial<Board> = {}
): Board {
  const stamp = new Date().toISOString()
  return {
    id: uid(),
    name: template.name,
    icon: template.icon,
    color: template.color,
    // The last lane of a multi-column template is where work lands finished.
    columns: template.columns.map((name, i, all) =>
      makeColumn(name, i, all.length > 1 && i === all.length - 1)
    ),
    createdAt: stamp,
    updatedAt: stamp,
    archived: false,
    order: 0,
    ...overrides
  }
}
