import { useState } from 'react'
import { Play, Plus, Trash2, Youtube } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { useMusicStore } from '@/stores/music-store'
import { isValidYoutubeUrl } from '@/lib/youtube'
import type { MusicSource } from '@shared/types'
import { uid } from '@/lib/utils'

export function MusicSourcesEditor(): JSX.Element {
  const sources = useAppStore((s) => s.settings.musicSources)
  const saveSettings = useAppStore((s) => s.saveSettings)
  const setActiveMusic = useMusicStore((s) => s.setActive)

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const invalid = url.trim().length > 0 && !isValidYoutubeUrl(url)

  const commit = (next: MusicSource[]): void => void saveSettings({ musicSources: next })

  const add = (): void => {
    if (!url.trim() || !isValidYoutubeUrl(url)) return
    const source: MusicSource = {
      id: uid(),
      name: name.trim() || 'Playlist',
      url: url.trim()
    }
    commit([...sources, source])
    setName('')
    setUrl('')
  }

  const update = (id: string, patch: Partial<MusicSource>): void =>
    commit(sources.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const remove = (id: string): void => commit(sources.filter((s) => s.id !== id))

  return (
    <div className="px-5 py-4">
      <div className="mb-3 space-y-2">
        {sources.map((s) => (
          <div
            key={s.id}
            className="group flex items-center gap-2 rounded-xl border border-border/70 bg-surface/40 p-2"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Youtube className="h-4 w-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <input
                defaultValue={s.name}
                onBlur={(e) => e.target.value.trim() && update(s.id, { name: e.target.value.trim() })}
                className="no-drag w-full bg-transparent text-sm font-medium focus:outline-none"
              />
              <input
                defaultValue={s.url}
                onBlur={(e) => e.target.value.trim() && update(s.id, { url: e.target.value.trim() })}
                className="no-drag w-full truncate bg-transparent text-xs text-muted-foreground focus:outline-none"
              />
            </div>
            <button
              onClick={() => setActiveMusic(s.id)}
              title="Tocar agora"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary"
            >
              <Play className="h-4 w-4" />
            </button>
            <button
              onClick={() => remove(s.id)}
              title="Remover"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {sources.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/70 py-6 text-center text-xs text-muted-foreground">
            Nenhuma playlist ainda. Cole a URL de uma playlist ou vídeo do YouTube abaixo.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome (ex: Lo-Fi Chill)"
          className="h-9 sm:w-48"
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Cole a URL do YouTube…"
          className="h-9 flex-1"
        />
        <Button variant="primary" onClick={add} disabled={invalid || !url.trim()} className="h-9">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>
      {invalid && (
        <p className="mt-2 text-xs text-destructive">
          Não reconheci uma playlist ou vídeo do YouTube nessa URL.
        </p>
      )}
    </div>
  )
}
