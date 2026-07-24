import { useNavigate } from 'react-router-dom'
import {
  CloudRain,
  Coffee,
  Trees,
  Waves,
  Music2,
  Wind,
  Volume2,
  VolumeX,
  Youtube,
  Plus
} from 'lucide-react'
import type { AmbientSound } from '@shared/types'
import { useAmbientStore } from '@/stores/ambient-store'
import { useAppStore } from '@/stores/app-store'
import { useMusicStore } from '@/stores/music-store'
import { Slider } from '@/components/ui/slider'
import { Tooltip } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const SOUNDS: { id: AmbientSound; label: string; icon: React.ElementType }[] = [
  { id: 'rain', label: 'Chuva', icon: CloudRain },
  { id: 'cafe', label: 'Café', icon: Coffee },
  { id: 'forest', label: 'Floresta', icon: Trees },
  { id: 'lofi', label: 'Lo-Fi', icon: Music2 },
  { id: 'white-noise', label: 'Ruído Branco', icon: Waves },
  { id: 'brown-noise', label: 'Ruído Marrom', icon: Wind }
]

export function AmbientBar(): JSX.Element {
  const { sound, volume, toggle, setVolume } = useAmbientStore()
  const musicSources = useAppStore((s) => s.settings.musicSources)
  const activeMusicId = useMusicStore((s) => s.activeId)
  const setActiveMusic = useMusicStore((s) => s.setActive)
  const navigate = useNavigate()

  return (
    <div className="mt-8 flex items-center gap-1.5 rounded-full border border-border/60 bg-surface/50 p-1.5 backdrop-blur-sm">
      {SOUNDS.map((s) => {
        const active = sound === s.id
        return (
          <Tooltip key={s.id} label={s.label} side="top">
            <button
              onClick={() => toggle(s.id)}
              className={cn(
                'no-drag flex h-9 w-9 items-center justify-center rounded-full transition-all',
                active
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              )}
            >
              <s.icon className="h-4 w-4" />
            </button>
          </Tooltip>
        )
      })}
      <div className="mx-1 h-5 w-px bg-border" />
      <button
        onClick={() => setVolume(volume > 0 ? 0 : 0.6)}
        className="no-drag flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
      >
        {volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </button>
      <Slider
        value={[volume]}
        min={0}
        max={1}
        step={0.01}
        onValueChange={([v]) => setVolume(v)}
        className="w-24 pr-3"
      />

      <div className="mx-1 h-5 w-px bg-border" />

      {/* YouTube playlists */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'no-drag flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-all',
              activeMusicId
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
            )}
          >
            <Youtube className="h-4 w-4" />
            Playlists
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="min-w-[16rem]">
          <DropdownMenuLabel>Suas playlists de lo-fi</DropdownMenuLabel>
          {musicSources.map((s) => (
            <DropdownMenuItem
              key={s.id}
              active={s.id === activeMusicId}
              onSelect={() => setActiveMusic(s.id)}
            >
              {s.name}
            </DropdownMenuItem>
          ))}
          {musicSources.length === 0 && (
            <div className="px-2.5 py-2 text-xs text-muted-foreground">
              Nenhuma playlist ainda.
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate('/settings')}>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Plus className="h-4 w-4" /> Gerenciar playlists
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
