import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { DynamicIcon, PROJECT_ICONS } from '@/components/dynamic-icon'
import { MoneyInput } from '@/features/finance/components/form'
import { ProjectBudgetBar } from '@/features/finance/components/project-budget-bar'
import { AppListEditor, ResourceListEditor, SiteListEditor } from './list-editors'
import { TaskManager } from './task-manager'
import { useAppStore } from '@/stores/app-store'
import type { AmbientSound, Project } from '@shared/types'
import { DURATION_PRESETS } from '@shared/types'
import { uid, cn } from '@/lib/utils'

const COLORS = [
  '250 82% 68%', '270 80% 66%', '190 90% 60%', '152 62% 47%',
  '25 95% 60%', '340 82% 66%', '0 72% 60%', '48 96% 58%'
]

const SOUNDS: { id: AmbientSound; label: string }[] = [
  { id: 'none', label: 'Nenhum' },
  { id: 'rain', label: 'Chuva' },
  { id: 'cafe', label: 'Café' },
  { id: 'forest', label: 'Floresta' },
  { id: 'lofi', label: 'Lo-Fi' },
  { id: 'white-noise', label: 'Ruído Branco' },
  { id: 'brown-noise', label: 'Ruído Marrom' }
]

const TABS = ['Identidade', 'Modo Flow', 'Tarefas'] as const
type Tab = (typeof TABS)[number]

function emptyProject(): Project {
  return {
    id: uid(),
    name: '',
    icon: 'Rocket',
    color: COLORS[0],
    description: '',
    defaultDurationMinutes: 45,
    defaultSound: 'none',
    flow: {
      launchApps: [],
      closeApps: [],
      openResources: [],
      blockSites: [],
      allowSites: [],
      doNotDisturb: true,
      ultraFocus: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archived: false,
    order: 0
  }
}

export function ProjectEditor({
  project,
  open,
  onClose
}: {
  project: Project | null
  open: boolean
  onClose: () => void
}): JSX.Element {
  const saveProject = useAppStore((s) => s.saveProject)
  const deleteProject = useAppStore((s) => s.deleteProject)
  const [tab, setTab] = useState<Tab>('Identidade')
  const [draft, setDraft] = useState<Project>(() => project ?? emptyProject())
  const isNew = useMemo(() => !project, [project])

  const patch = (p: Partial<Project>): void => setDraft((d) => ({ ...d, ...p }))
  const patchFlow = (f: Partial<Project['flow']>): void =>
    setDraft((d) => ({ ...d, flow: { ...d.flow, ...f } }))

  const save = (): void => {
    if (!draft.name.trim()) {
      setTab('Identidade')
      return
    }
    void saveProject(draft)
    onClose()
  }

  const remove = (): void => {
    if (project) void deleteProject(project.id)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
        <div className="border-b border-border px-6 py-4">
          <DialogHeader className="mb-0">
            <DialogTitle>{isNew ? 'Novo projeto' : draft.name || 'Projeto'}</DialogTitle>
            <DialogDescription>
              Configure o ambiente que será montado ao iniciar uma sessão.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'no-drag rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  tab === t
                    ? 'bg-surface-elevated text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[52vh] space-y-5 overflow-y-auto px-6 py-5 scrollbar-thin">
          {tab === 'Identidade' && (
            <>
              <Field label="Nome">
                <Input
                  value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Ex: Dopanimes"
                  autoFocus
                />
              </Field>
              <Field label="Ícone">
                <div className="flex flex-wrap gap-1.5">
                  {PROJECT_ICONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => patch({ icon })}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
                        draft.icon === icon
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border text-muted-foreground hover:bg-surface-hover'
                      )}
                    >
                      <DynamicIcon name={icon} className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Cor">
                <div className="flex gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => patch({ color })}
                      className={cn(
                        'h-8 w-8 rounded-full transition-transform hover:scale-110',
                        draft.color === color && 'ring-2 ring-offset-2 ring-offset-background'
                      )}
                      style={{
                        background: `hsl(${color})`,
                        boxShadow: draft.color === color ? `0 0 0 2px hsl(${color})` : undefined
                      }}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Descrição">
                <Textarea
                  value={draft.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="Sobre o que é este projeto?"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Duração padrão">
                  <div className="flex gap-1.5">
                    {DURATION_PRESETS.map((m) => (
                      <button
                        key={m}
                        onClick={() => patch({ defaultDurationMinutes: m })}
                        className={cn(
                          'h-9 flex-1 rounded-lg text-sm transition-colors',
                          draft.defaultDurationMinutes === m
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-surface-elevated text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Som padrão">
                  <select
                    value={draft.defaultSound}
                    onChange={(e) => patch({ defaultSound: e.target.value as AmbientSound })}
                    className="no-drag h-9 w-full rounded-xl border border-input bg-surface/60 px-3 text-sm focus:outline-none focus:border-primary/60"
                  >
                    {SOUNDS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field
                label="Orçamento do projeto"
                hint="Some as despesas marcadas com este projeto no Finance HUB. Deixe zerado para não acompanhar."
              >
                <MoneyInput
                  value={draft.budget ?? 0}
                  onChange={(budget) => patch({ budget: budget > 0 ? budget : undefined })}
                />
              </Field>
              {draft.budget ? <ProjectBudgetBar projectId={draft.id} budget={draft.budget} /> : null}
            </>
          )}

          {tab === 'Modo Flow' && (
            <>
              <ToggleRow
                title="Modo Ultra Focus"
                desc="Entra na tela minimalista automaticamente."
                checked={draft.flow.ultraFocus}
                onChange={(v) => patchFlow({ ultraFocus: v })}
              />
              <ToggleRow
                title="Não Perturbe"
                desc="Silencia notificações durante a sessão."
                checked={draft.flow.doNotDisturb}
                onChange={(v) => patchFlow({ doNotDisturb: v })}
              />
              <Field label="Abrir aplicativos" hint="Iniciados ao começar a sessão.">
                <AppListEditor
                  value={draft.flow.launchApps}
                  onChange={(v) => patchFlow({ launchApps: v })}
                  placeholder="C:\\...\\App.exe"
                />
              </Field>
              <Field label="Fechar aplicativos" hint="Encerrados ao começar a sessão.">
                <AppListEditor
                  value={draft.flow.closeApps}
                  onChange={(v) => patchFlow({ closeApps: v })}
                  placeholder="Discord.exe"
                />
              </Field>
              <Field label="Abrir arquivos, pastas e páginas">
                <ResourceListEditor
                  value={draft.flow.openResources}
                  onChange={(v) => patchFlow({ openResources: v })}
                />
              </Field>
              <Field label="Bloquear sites" hint="Requer executar como administrador.">
                <SiteListEditor
                  value={draft.flow.blockSites}
                  onChange={(v) => patchFlow({ blockSites: v })}
                  placeholder="youtube.com"
                />
              </Field>
              <Field label="Sites permitidos" hint="Abertos automaticamente ao iniciar.">
                <SiteListEditor
                  value={draft.flow.allowSites}
                  onChange={(v) => patchFlow({ allowSites: v })}
                  placeholder="docs.google.com"
                />
              </Field>
            </>
          )}

          {tab === 'Tarefas' && <TaskManager projectId={draft.id} />}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          {!isNew ? (
            <Button variant="ghost" onClick={remove} className="text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={save}>
              Salvar projeto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-sm font-medium">{label}</label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function ToggleRow({
  title,
  desc,
  checked,
  onChange
}: {
  title: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
}): JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
