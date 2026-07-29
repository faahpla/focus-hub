import type { Board, BoardColumn } from '@shared/types'
import { uid } from '@/lib/utils'

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

export function makeColumn(name: string, order: number): BoardColumn {
  return {
    id: uid(),
    name,
    color: COLUMN_COLORS[order % COLUMN_COLORS.length],
    order
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
    columns: template.columns.map(makeColumn),
    createdAt: stamp,
    updatedAt: stamp,
    archived: false,
    order: 0,
    ...overrides
  }
}
