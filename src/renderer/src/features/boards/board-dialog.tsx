import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DynamicIcon, PROJECT_ICONS } from '@/components/dynamic-icon'
import { useAppStore } from '@/stores/app-store'
import type { Board } from '@shared/types'
import { BOARD_TEMPLATES, COLUMN_COLORS, makeBoard } from './board-templates'
import { cn } from '@/lib/utils'

/**
 * Create a new board from a template, or edit an existing one's identity
 * (name, icon, color, project link). Columns are edited on the board itself.
 */
export function BoardDialog({
  board,
  onClose,
  onCreated
}: {
  board?: Board
  onClose: () => void
  onCreated?: (id: string) => void
}): JSX.Element {
  const projects = useAppStore((s) => s.projects)
  const saveBoard = useAppStore((s) => s.saveBoard)
  const editing = Boolean(board)

  const [templateId, setTemplateId] = useState(BOARD_TEMPLATES[0].id)
  const template = BOARD_TEMPLATES.find((t) => t.id === templateId) ?? BOARD_TEMPLATES[0]

  const [name, setName] = useState(board?.name ?? '')
  const [icon, setIcon] = useState(board?.icon ?? template.icon)
  const [color, setColor] = useState(board?.color ?? template.color)
  const [projectId, setProjectId] = useState<string | undefined>(board?.projectId)

  const activeProjects = projects.filter((p) => !p.archived)
  const linkedProject = activeProjects.find((p) => p.id === projectId)

  const pickTemplate = (id: string): void => {
    const t = BOARD_TEMPLATES.find((x) => x.id === id)
    if (!t) return
    setTemplateId(id)
    setIcon(t.icon)
    setColor(t.color)
  }

  const submit = (): void => {
    const finalName = name.trim() || (editing ? board!.name : template.name)
    if (editing && board) {
      void saveBoard({ ...board, name: finalName, icon, color, projectId })
    } else {
      const created = makeBoard(template, { name: finalName, icon, color, projectId })
      void saveBoard(created)
      onCreated?.(created.id)
    }
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar quadro' : 'Novo quadro'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Mude o nome, o visual e o projeto vinculado.'
              : 'Escolha um modelo de colunas — dá pra ajustar tudo depois.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {!editing && (
            <div>
              <p className="mb-2 text-sm font-medium">Modelo</p>
              <div className="grid gap-2">
                {BOARD_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => pickTemplate(t.id)}
                    className={cn(
                      'no-drag flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                      t.id === templateId
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-border/70 bg-surface/40 hover:bg-surface-hover'
                    )}
                  >
                    <DynamicIcon
                      name={t.icon}
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: `hsl(${t.color})` }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                    </div>
                    {t.id === templateId && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">Nome</p>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={editing ? board?.name : template.name}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Cor</p>
            <div className="flex flex-wrap gap-2">
              {COLUMN_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'no-drag h-7 w-7 rounded-full transition-transform hover:scale-110',
                    color === c && 'ring-2 ring-foreground/70 ring-offset-2 ring-offset-surface-elevated'
                  )}
                  style={{ backgroundColor: `hsl(${c})` }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Ícone</p>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_ICONS.slice(0, 14).map((name) => (
                <button
                  key={name}
                  onClick={() => setIcon(name)}
                  className={cn(
                    'no-drag flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
                    icon === name
                      ? 'border-primary/60 bg-primary/10 text-primary'
                      : 'border-border/70 text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                  )}
                >
                  <DynamicIcon name={name} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Projeto vinculado</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Opcional. Com um projeto vinculado, os cards viram tarefas dele em 1 clique.
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="no-drag flex h-10 w-full items-center justify-between rounded-xl border border-input bg-surface/60 px-3.5 text-sm transition-colors hover:bg-surface-hover">
                  <span className="flex items-center gap-2">
                    {linkedProject ? (
                      <>
                        <DynamicIcon
                          name={linkedProject.icon}
                          className="h-4 w-4"
                          style={{ color: `hsl(${linkedProject.color})` }}
                        />
                        {linkedProject.name}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Nenhum</span>
                    )}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[18rem]">
                <DropdownMenuLabel>Projetos</DropdownMenuLabel>
                {activeProjects.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    active={p.id === projectId}
                    onSelect={() => setProjectId(p.id)}
                  >
                    <span className="flex items-center gap-2">
                      <DynamicIcon
                        name={p.icon}
                        className="h-4 w-4"
                        style={{ color: `hsl(${p.color})` }}
                      />
                      {p.name}
                    </span>
                  </DropdownMenuItem>
                ))}
                {activeProjects.length === 0 && (
                  <div className="px-2.5 py-2 text-sm text-muted-foreground">
                    Nenhum projeto ainda.
                  </div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  active={!projectId}
                  onSelect={() => setProjectId(undefined)}
                >
                  Nenhum
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit}>
            {editing ? 'Salvar' : 'Criar quadro'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
