import { useEffect, useState } from 'react'
import { ChevronDown, KanbanSquare, Pencil, Plus, Ticket, Trash2, Users } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { DynamicIcon } from '@/components/dynamic-icon'
import { useAppStore } from '@/stores/app-store'
import { useBoardsUiStore } from '@/stores/boards-ui-store'
import { BoardDialog } from './board-dialog'
import { BoardView } from './board-view'
import { JoinDialog } from '@/features/sharing/join-dialog'
import { ShareDialog } from '@/features/sharing/share-dialog'

export function BoardsPage(): JSX.Element {
  const boards = useAppStore((s) => s.boards)
  const projects = useAppStore((s) => s.projects)
  const cards = useAppStore((s) => s.cards)
  const deleteBoard = useAppStore((s) => s.deleteBoard)

  const selectedId = useBoardsUiStore((s) => s.selectedId)
  const setSelectedId = useBoardsUiStore((s) => s.select)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [joining, setJoining] = useState(false)

  const active = boards.find((b) => b.id === selectedId) ?? boards[0]

  // Remember the board actually shown, which falls back to the first one
  // when the stored choice no longer exists.
  useEffect(() => {
    if (active && active.id !== selectedId) setSelectedId(active.id)
  }, [active?.id])

  if (boards.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <KanbanSquare className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Seus quadros moram aqui</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Arraste cards entre colunas para acompanhar cada etapa — e transforme qualquer card em
          uma tarefa com sessão de foco quando for hora de trabalhar nele.
        </p>
        <Button variant="primary" className="mt-6" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Criar meu primeiro quadro
        </Button>
        {/* Someone invited to a board starts here, with nothing of their own yet. */}
        <Button variant="ghost" className="mt-2" onClick={() => setJoining(true)}>
          <Ticket className="h-4 w-4" /> Tenho um código de convite
        </Button>

        {creating && (
          <BoardDialog onClose={() => setCreating(false)} onCreated={setSelectedId} />
        )}
        {joining && <JoinDialog onClose={() => setJoining(false)} onJoined={setSelectedId} />}
      </div>
    )
  }

  const member = active?.shared?.role === 'member'

  const project = active?.projectId
    ? projects.find((p) => p.id === active.projectId)
    : undefined
  const cardCount = active ? cards.filter((c) => c.boardId === active.id).length : 0

  return (
    <div className="flex h-full flex-col">
      {/* Header with board switcher */}
      <div className="flex items-center justify-between gap-4 px-8 pb-5 pt-8">
        <div className="flex min-w-0 items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="no-drag group flex min-w-0 items-center gap-2.5">
                {active && (
                  <DynamicIcon
                    name={active.icon}
                    className="h-6 w-6 shrink-0"
                    style={{ color: `hsl(${active.color})` }}
                  />
                )}
                <h1 className="truncate text-2xl font-semibold tracking-tight transition-colors group-hover:text-primary">
                  {active?.name}
                </h1>
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[16rem]">
              <DropdownMenuLabel>Quadros</DropdownMenuLabel>
              {boards.map((b) => (
                <DropdownMenuItem
                  key={b.id}
                  active={b.id === active?.id}
                  onSelect={() => setSelectedId(b.id)}
                >
                  <span className="flex items-center gap-2">
                    <DynamicIcon
                      name={b.icon}
                      className="h-4 w-4"
                      style={{ color: `hsl(${b.color})` }}
                    />
                    {b.name}
                    {b.shared && (
                      <Users
                        className="h-3 w-3 text-muted-foreground"
                        aria-label="Compartilhado"
                      />
                    )}
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setCreating(true)}>
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Novo quadro
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setJoining(true)}>
                <span className="flex items-center gap-2">
                  <Ticket className="h-4 w-4" /> Entrar com código
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {project && (
            <span
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-surface/60 px-2.5 py-1 text-xs text-muted-foreground"
              title="Cards deste quadro viram tarefas neste projeto"
            >
              <DynamicIcon
                name={project.icon}
                className="h-3.5 w-3.5"
                style={{ color: `hsl(${project.color})` }}
              />
              {project.name}
            </span>
          )}
          <span className="shrink-0 text-xs text-muted-foreground">
            {cardCount} {cardCount === 1 ? 'card' : 'cards'}
          </span>
          {active?.shared && (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
              <Users className="h-3.5 w-3.5" />
              {member ? 'Compartilhado com você' : 'Compartilhado'}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setSharing(true)}>
            <Users className="h-3.5 w-3.5" /> {active?.shared ? 'Acesso' : 'Compartilhar'}
          </Button>
          {/* The name and look of a shared board are its owner's. */}
          {!member && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Novo quadro
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="px-2">
                <Trash2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Deleting means three different things depending on whose board it is. */}
              <DropdownMenuLabel>
                {member ? `Sair de “${active?.name}”?` : `Excluir “${active?.name}”?`}
              </DropdownMenuLabel>
              <div className="max-w-[18rem] px-2.5 pb-1 text-xs text-muted-foreground">
                {member
                  ? 'O quadro some deste PC. O dono e as outras pessoas continuam com ele.'
                  : active?.shared
                    ? 'Ele é compartilhado: some para todo mundo que tem acesso, não só para você.'
                    : 'Os cards deste quadro somem. Tarefas vinculadas continuam existindo.'}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive data-[highlighted]:bg-destructive/10"
                onSelect={() => {
                  if (!active) return
                  void deleteBoard(active.id)
                  setSelectedId(boards.find((b) => b.id !== active.id)?.id ?? null)
                }}
              >
                {member
                  ? 'Sim, sair do quadro'
                  : active?.shared
                    ? 'Sim, excluir para todos'
                    : 'Sim, excluir quadro'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Board */}
      <div className="min-h-0 flex-1">{active && <BoardView board={active} />}</div>

      {creating && <BoardDialog onClose={() => setCreating(false)} onCreated={setSelectedId} />}
      {editing && active && <BoardDialog board={active} onClose={() => setEditing(false)} />}
      {sharing && active && <ShareDialog board={active} onClose={() => setSharing(false)} />}
      {joining && <JoinDialog onClose={() => setJoining(false)} onJoined={setSelectedId} />}
    </div>
  )
}
