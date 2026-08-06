import { useState } from 'react'
import { FolderOpen, Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { FlowApp, FlowResource } from '@shared/types'
import { normalizeHost } from '@shared/flow'
import { uid } from '@/lib/utils'

/** Simple chip-based editor for a list of hostnames. */
export function SiteListEditor({
  value,
  onChange,
  placeholder
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder: string
}): JSX.Element {
  const [draft, setDraft] = useState('')
  const add = (): void => {
    const host = normalizeHost(draft)
    if (host && !value.includes(host)) onChange([...value, host])
    setDraft('')
  }
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {value.map((site) => (
          <span
            key={site}
            className="flex items-center gap-1 rounded-lg bg-surface-elevated px-2 py-1 text-xs"
          >
            {site}
            <button
              onClick={() => onChange(value.filter((s) => s !== site))}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {value.length === 0 && (
          <span className="text-xs text-muted-foreground">Nenhum site.</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="h-9"
        />
        <Button size="sm" variant="secondary" onClick={add} className="h-9">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/** Editor for apps (name + executable path or name). */
export function AppListEditor({
  value,
  onChange,
  placeholder
}: {
  value: FlowApp[]
  onChange: (v: FlowApp[]) => void
  placeholder: string
}): JSX.Element {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')

  const add = (): void => {
    if (!name.trim() || !path.trim()) return
    onChange([...value, { id: uid(), name: name.trim(), path: path.trim() }])
    setName('')
    setPath('')
  }
  const pick = async (): Promise<void> => {
    const p = await window.focusHub.pickPath('file')
    if (p) {
      setPath(p)
      if (!name) setName(p.split(/[\\/]/).pop()?.replace(/\.exe$/i, '') ?? '')
    }
  }

  return (
    <div>
      <div className="mb-2 space-y-1.5">
        {value.map((app) => (
          <div
            key={app.id}
            className="flex items-center gap-2 rounded-lg bg-surface-elevated px-2.5 py-1.5 text-xs"
          >
            <span className="font-medium">{app.name}</span>
            <span className="flex-1 truncate text-muted-foreground">{app.path}</span>
            <button
              onClick={() => onChange(value.filter((a) => a.id !== app.id))}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {value.length === 0 && (
          <span className="text-xs text-muted-foreground">Nenhum aplicativo.</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
          className="h-9 w-28"
        />
        <Input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="h-9 flex-1"
        />
        <Button size="sm" variant="secondary" onClick={pick} className="h-9" title="Escolher arquivo">
          <FolderOpen className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="secondary" onClick={add} className="h-9">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/** Editor for resources (files, folders, urls). */
export function ResourceListEditor({
  value,
  onChange
}: {
  value: FlowResource[]
  onChange: (v: FlowResource[]) => void
}): JSX.Element {
  const [label, setLabel] = useState('')
  const [path, setPath] = useState('')

  const add = (kind: FlowResource['kind']): void => {
    if (!path.trim()) return
    onChange([
      ...value,
      { id: uid(), label: label.trim() || path.trim(), path: path.trim(), kind }
    ])
    setLabel('')
    setPath('')
  }
  const pickAndAdd = async (kind: 'file' | 'folder'): Promise<void> => {
    const p = await window.focusHub.pickPath(kind)
    if (!p) return
    onChange([
      ...value,
      { id: uid(), label: label.trim() || (p.split(/[\\/]/).pop() ?? p), path: p, kind }
    ])
    setLabel('')
    setPath('')
  }

  return (
    <div>
      <div className="mb-2 space-y-1.5">
        {value.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 rounded-lg bg-surface-elevated px-2.5 py-1.5 text-xs"
          >
            <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
              {r.kind}
            </span>
            <span className="font-medium">{r.label}</span>
            <span className="flex-1 truncate text-muted-foreground">{r.path}</span>
            <button
              onClick={() => onChange(value.filter((x) => x.id !== r.id))}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {value.length === 0 && (
          <span className="text-xs text-muted-foreground">Nenhum recurso.</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Rótulo"
          className="h-9 w-28"
        />
        <Input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="Caminho ou URL"
          className="h-9 flex-1"
        />
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => pickAndAdd('file')} className="h-9">
            Arquivo
          </Button>
          <Button size="sm" variant="secondary" onClick={() => pickAndAdd('folder')} className="h-9">
            Pasta
          </Button>
          <Button size="sm" variant="secondary" onClick={() => add('url')} className="h-9">
            + URL
          </Button>
        </div>
      </div>
    </div>
  )
}
