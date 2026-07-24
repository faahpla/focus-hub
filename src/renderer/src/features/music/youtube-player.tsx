import { useEffect, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, motion, useDragControls, useMotionValue } from 'framer-motion'
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Slider } from '@/components/ui/slider'
import { useAppStore } from '@/stores/app-store'
import { useMusicStore } from '@/stores/music-store'
import { parseYoutubeSource } from '@/lib/youtube'
import { loadYouTubeApi, type YTPlayer } from '@/lib/youtube-api'
import { cn } from '@/lib/utils'

export function YoutubePlayer({
  dragBoundsRef
}: {
  dragBoundsRef: RefObject<HTMLElement>
}): JSX.Element {
  const sources = useAppStore((s) => s.settings.musicSources)
  const {
    activeId,
    expanded,
    volume,
    muted,
    position,
    setActive,
    stop,
    toggleExpand,
    setVolume,
    toggleMute,
    setPosition
  } = useMusicStore()

  const active = sources.find((s) => s.id === activeId)
  const hostRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()
  const x = useMotionValue(position.x)
  const y = useMotionValue(position.y)

  // Pull the panel back into view if a restored position ended up off-screen
  // (e.g. the window was resized or maximized since last session).
  useEffect(() => {
    if (!active) return
    const id = requestAnimationFrame(() => {
      const bounds = dragBoundsRef.current?.getBoundingClientRect()
      const panel = panelRef.current?.getBoundingClientRect()
      if (!bounds || !panel) return
      let nx = x.get()
      let ny = y.get()
      const m = 8
      if (panel.right > bounds.right - m) nx -= panel.right - (bounds.right - m)
      if (panel.left < bounds.left + m) nx += bounds.left + m - panel.left
      if (panel.bottom > bounds.bottom - m) ny -= panel.bottom - (bounds.bottom - m)
      if (panel.top < bounds.top + m) ny += bounds.top + m - panel.top
      if (nx !== x.get() || ny !== y.get()) {
        x.set(nx)
        y.set(ny)
        setPosition({ x: nx, y: ny })
      }
    })
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
  const playerRef = useRef<YTPlayer | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [invalid, setInvalid] = useState(false)

  // Create / recreate the player whenever the selected source changes.
  useEffect(() => {
    if (!active) return
    const src = parseYoutubeSource(active.url)
    if (!src || !hostRef.current) {
      setInvalid(!src)
      return
    }
    setInvalid(false)
    setReady(false)
    setPlaying(false)

    let cancelled = false
    // YT replaces the target node with an iframe, so give it a throwaway child.
    const mount = document.createElement('div')
    mount.style.width = '100%'
    mount.style.height = '100%'
    hostRef.current.innerHTML = ''
    hostRef.current.appendChild(mount)

    loadYouTubeApi().then((YT) => {
      if (cancelled) return
      playerRef.current = new YT.Player(mount, {
        width: '100%',
        height: '100%',
        videoId: src.type === 'video' ? src.videoId : undefined,
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          ...(src.type === 'playlist' ? { list: src.list, listType: 'playlist' } : {})
        },
        events: {
          onReady: (e) => {
            setReady(true)
            e.target.setVolume(Math.round(volume * 100))
            if (muted) e.target.mute()
          },
          onStateChange: (e) => setPlaying(e.data === YT.PlayerState.PLAYING)
        }
      })
    })

    return () => {
      cancelled = true
      try {
        playerRef.current?.destroy()
      } catch {
        /* ignore */
      }
      playerRef.current = null
      if (hostRef.current) hostRef.current.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // Keep the player's volume / mute in sync with the app controls.
  useEffect(() => {
    if (ready && playerRef.current) playerRef.current.setVolume(Math.round(volume * 100))
  }, [volume, ready])
  useEffect(() => {
    if (!ready || !playerRef.current) return
    if (muted) playerRef.current.mute()
    else playerRef.current.unMute()
  }, [muted, ready])

  const p = playerRef.current
  const togglePlay = (): void => {
    if (!p) return
    playing ? p.pauseVideo() : p.playVideo()
  }

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          ref={panelRef}
          drag
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          dragElastic={0.06}
          dragConstraints={dragBoundsRef}
          onDragEnd={() => setPosition({ x: x.get(), y: y.get() })}
          style={{ x, y }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="no-drag absolute bottom-4 left-[84px] z-40 w-72 overflow-hidden rounded-2xl border border-border/80 bg-surface-elevated/95 shadow-elevated backdrop-blur-xl"
        >
          {/* Title bar — drag handle */}
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="flex cursor-grab touch-none items-center gap-1.5 px-2.5 py-2 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Music2 className="h-3 w-3" />
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex min-w-0 flex-1 items-center gap-1 text-left"
                >
                  <span className="truncate text-xs font-medium">{active.name}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="min-w-[15rem]">
                <DropdownMenuLabel>Trocar playlist</DropdownMenuLabel>
                {sources.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    active={s.id === activeId}
                    onSelect={() => setActive(s.id)}
                  >
                    {s.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={toggleExpand}
              title={expanded ? 'Ocultar vídeo' : 'Mostrar vídeo'}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              {expanded ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={stop}
              title="Parar música"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Video (kept mounted; height 0 when collapsed so audio continues) */}
          <div
            className={cn(
              'overflow-hidden transition-[height] duration-300',
              expanded ? 'h-[162px]' : 'h-0'
            )}
          >
            {invalid ? (
              <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
                URL inválida — edite a playlist nos Ajustes.
              </div>
            ) : (
              <div ref={hostRef} className="h-full w-full bg-black" />
            )}
          </div>

          {/* App-native transport + volume */}
          <div className="flex items-center gap-1.5 border-t border-border/60 px-3 py-2">
            <button
              onClick={() => p?.previousVideo()}
              disabled={!ready}
              title="Anterior"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-40"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={togglePlay}
              disabled={!ready}
              title={playing ? 'Pausar' : 'Tocar'}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:opacity-40"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
            </button>
            <button
              onClick={() => p?.nextVideo()}
              disabled={!ready}
              title="Próxima"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-40"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <button
              onClick={toggleMute}
              title={muted ? 'Ativar som' : 'Silenciar'}
              className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
            >
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <Slider
              value={[muted ? 0 : volume]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={([v]) => setVolume(v)}
              className="flex-1 pr-1"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
