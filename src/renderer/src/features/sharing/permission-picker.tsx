import { Check } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { FULL_PERMISSIONS, type SharePermissions, type ShareRole } from '@shared/sync'

const FLAGS: { key: keyof SharePermissions; label: string; hint: string }[] = [
  { key: 'createCards', label: 'Criar cards', hint: 'Adicionar e duplicar cards nas colunas' },
  { key: 'deleteCards', label: 'Excluir cards', hint: 'Apagar cards ou tirá-los do quadro' },
  {
    key: 'manageColumns',
    label: 'Mexer nas colunas',
    hint: 'Criar, renomear, recolorir e apagar colunas'
  }
]

/**
 * Pick what someone may do on a shared board: the one-click Editor preset, or
 * a hand-picked set. Seeing, editing and moving cards are always granted —
 * the point of sharing — so they are stated, not offered.
 */
export function PermissionPicker({
  role,
  can,
  onChange
}: {
  role: ShareRole
  can: SharePermissions
  onChange: (role: ShareRole, can: SharePermissions) => void
}): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <RoleCard
          active={role === 'editor'}
          title="Editor"
          description="Pode tudo no quadro"
          onClick={() => onChange('editor', { ...FULL_PERMISSIONS })}
        />
        <RoleCard
          active={role === 'custom'}
          title="Personalizado"
          description="Você escolhe o quê"
          onClick={() => onChange('custom', can)}
        />
      </div>

      {role === 'custom' && (
        <div className="space-y-1 rounded-xl border border-border/70 bg-surface/40 p-2">
          {FLAGS.map((flag) => (
            <label
              key={flag.key}
              className="no-drag flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-hover"
            >
              <span className="min-w-0">
                <span className="block text-sm">{flag.label}</span>
                <span className="block text-[11px] text-muted-foreground">{flag.hint}</span>
              </span>
              <Switch
                checked={can[flag.key]}
                onCheckedChange={(on) => onChange('custom', { ...can, [flag.key]: on })}
              />
            </label>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Ver, editar e mover cards entre colunas está sempre liberado.
      </p>
    </div>
  )
}

function RoleCard({
  active,
  title,
  description,
  onClick
}: {
  active: boolean
  title: string
  description: string
  onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        'no-drag flex items-start gap-2 rounded-xl border p-3 text-left transition-colors',
        active
          ? 'border-primary/60 bg-primary/10'
          : 'border-border/70 bg-surface/40 hover:bg-surface-hover'
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  )
}

/** "Editor", or the flags a custom role turns on, said in a few words. */
export function describeAccess(role: ShareRole, can: SharePermissions): string {
  if (role === 'editor') return 'Editor'
  const on = FLAGS.filter((f) => can[f.key]).map((f) => f.label.toLowerCase())
  return on.length ? `Personalizado: ${on.join(', ')}` : 'Personalizado: só editar e mover'
}
