import { useState } from 'react'
import { Eye, Pin, Plus, Star, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Labels by how many times they appear, most used first. */
export function byUse(labels: string[]): string[] {
  const counts = new Map<string, number>()
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([label]) => label)
}

/**
 * One-click chips under a card's steps or tags: the fixed ones the user set,
 * then suggestions drawn from what other cards use.
 *
 * Everything shown here can be changed. Fixed chips are renamed and removed
 * one by one, not by retyping a comma list; a suggestion can be pinned or
 * dismissed for good — it comes from history, so without that a typo used
 * once kept coming back on every card forever.
 */
export function QuickPicks({
  kind,
  current,
  used,
  presets,
  hidden,
  onPick,
  onPresetsChange,
  onHiddenChange,
  draft,
  onClearDraft,
  suggestionLimit
}: {
  kind: 'tag' | 'step'
  /** Already on the card: not offered again. */
  current: string[]
  /** Labels other cards use, most frequent first. */
  used: string[]
  presets: string[]
  hidden: string[]
  onPick: (label: string) => void
  onPresetsChange: (next: string[]) => void
  onHiddenChange: (next: string[]) => void
  /** Tags only: what is being typed, offered as "Fixar". */
  draft?: string
  onClearDraft?: () => void
  suggestionLimit: number
}): JSX.Element {
  const [editing, setEditing] = useState(false)
  const shown = (label: string): string => (kind === 'tag' ? `#${label}` : label)

  const pinned = presets.filter((p) => !current.includes(p))
  const suggestions = used
    .filter((u) => !current.includes(u) && !presets.includes(u) && !hidden.includes(u))
    .slice(0, suggestionLimit)
  const trimmedDraft = (draft ?? '').trim()
  const canPinDraft = kind === 'tag' && trimmedDraft.length > 0 && !presets.includes(trimmedDraft)

  if (editing) {
    return (
      <ManagePanel
        kind={kind}
        presets={presets}
        suggestions={used.filter((u) => !presets.includes(u) && !hidden.includes(u)).slice(0, 20)}
        hiddenCount={hidden.length}
        shown={shown}
        onPresetsChange={onPresetsChange}
        onHide={(label) => onHiddenChange([...hidden, label])}
        onRestoreHidden={() => onHiddenChange([])}
        onClose={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="mt-2">
      {(pinned.length > 0 || suggestions.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {pinned.map((label) => (
            <button
              key={label}
              onClick={() => onPick(label)}
              className="no-drag flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary transition-colors hover:bg-primary/20"
            >
              {kind === 'tag' ? (
                <Star className="h-2.5 w-2.5 fill-current" />
              ) : (
                <Plus className="h-2.5 w-2.5" />
              )}
              {shown(label)}
            </button>
          ))}
          {suggestions.map((label) => (
            <button
              key={label}
              onClick={() => onPick(label)}
              className="no-drag rounded-lg border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {shown(label)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-2">
        {canPinDraft && (
          <button
            onClick={() => {
              onPresetsChange([...presets, trimmedDraft])
              onPick(trimmedDraft)
              onClearDraft?.()
            }}
            className="no-drag flex items-center gap-1 text-[11px] text-primary transition-colors hover:underline"
          >
            <Star className="h-2.5 w-2.5" /> Fixar “{trimmedDraft}”
          </button>
        )}
        <button
          onClick={() => setEditing(true)}
          className="no-drag ml-auto text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Editar atalhos
        </button>
      </div>
    </div>
  )
}

function ManagePanel({
  kind,
  presets,
  suggestions,
  hiddenCount,
  shown,
  onPresetsChange,
  onHide,
  onRestoreHidden,
  onClose
}: {
  kind: 'tag' | 'step'
  presets: string[]
  suggestions: string[]
  hiddenCount: number
  shown: (label: string) => string
  onPresetsChange: (next: string[]) => void
  onHide: (label: string) => void
  onRestoreHidden: () => void
  onClose: () => void
}): JSX.Element {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [newDraft, setNewDraft] = useState('')
  const clean = (s: string): string => (kind === 'tag' ? s.trim().replace(/^#+/, '') : s.trim())

  const commitRename = (): void => {
    const from = renaming
    const to = clean(renameDraft)
    setRenaming(null)
    if (!from || !to || to === from) return
    // Renamed onto one already fixed: the two become one.
    onPresetsChange(
      presets.includes(to) ? presets.filter((p) => p !== from) : presets.map((p) => (p === from ? to : p))
    )
  }

  const addNew = (): void => {
    const label = clean(newDraft)
    if (label && !presets.includes(label)) onPresetsChange([...presets, label])
    setNewDraft('')
  }

  const chip =
    'flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] transition-colors'

  return (
    <div className="mt-2 space-y-2.5 rounded-xl border border-border/70 bg-surface/50 p-2.5">
      <div>
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
          Fixas — aparecem em todo card. Duplo clique renomeia.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((label) =>
            renaming === label ? (
              <input
                key={label}
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') {
                    e.stopPropagation()
                    setRenaming(null)
                  }
                }}
                className="no-drag h-6 w-28 rounded-lg border border-primary/50 bg-surface-elevated px-2 text-[11px] focus:outline-none"
              />
            ) : (
              <span
                key={label}
                onDoubleClick={() => {
                  setRenaming(label)
                  setRenameDraft(label)
                }}
                className={cn(chip, 'cursor-text select-none border-primary/30 bg-primary/10 text-primary')}
              >
                {shown(label)}
                <button
                  onClick={() => onPresetsChange(presets.filter((p) => p !== label))}
                  title="Tirar das fixas"
                  className="no-drag text-primary/60 hover:text-destructive"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )
          )}
          <input
            value={newDraft}
            onChange={(e) => setNewDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNew()}
            onBlur={addNew}
            placeholder={kind === 'tag' ? 'Nova tag fixa…' : 'Nova etapa fixa…'}
            className="no-drag h-6 w-32 rounded-lg border border-dashed border-border bg-transparent px-2 text-[11px] placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none"
          />
        </div>
      </div>

      {suggestions.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            Sugestões — vêm de outros cards. Fixe ou esconda de vez.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((label) => (
              <span key={label} className={cn(chip, 'border-border/70 text-muted-foreground')}>
                {shown(label)}
                <button
                  onClick={() => onPresetsChange([...presets, label])}
                  title="Fixar"
                  className="no-drag hover:text-primary"
                >
                  <Pin className="h-2.5 w-2.5" />
                </button>
                <button
                  onClick={() => onHide(label)}
                  title="Não sugerir mais"
                  className="no-drag hover:text-destructive"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        {hiddenCount > 0 ? (
          <button
            onClick={onRestoreHidden}
            className="no-drag flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Eye className="h-3 w-3" /> Mostrar escondidas de novo ({hiddenCount})
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={onClose}
          className="no-drag text-[11px] font-medium text-primary transition-colors hover:underline"
        >
          Pronto
        </button>
      </div>
    </div>
  )
}
