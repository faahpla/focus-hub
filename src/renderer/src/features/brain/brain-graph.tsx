import { useEffect, useMemo, useRef, useState } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum
} from 'd3-force'
import { Crosshair, Tag, Unlink } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { useBrainUiStore } from '@/stores/brain-ui-store'
import { cn } from '@/lib/utils'
import { linksIn, noteMatches, notesByTitle, titleKey } from './brain-links'

/**
 * The Brain as a map, like Obsidian's graph: every note a dot, every
 * `[[link]]` a line. Topics can show as hubs that pull their notes together,
 * so each anime reads as a cluster and the links that cross between them
 * stand out.
 *
 * Drawn on a canvas with d3-force doing the physics. Hover lights a note up
 * with its neighbours; drag moves a dot (or the whole map, from empty space);
 * the wheel zooms; a click opens the note.
 */

interface GNode extends SimulationNodeDatum {
  id: string
  kind: 'note' | 'topic'
  label: string
  /** HSL channels. Notes take their first topic's colour. */
  color?: string
  r: number
}

interface GLink extends SimulationLinkDatum<GNode> {
  kind: 'link' | 'topic'
}

const PREFS_KEY = 'focus-hub:brain-map'

function readPrefs(): { topics: boolean; orphans: boolean } {
  try {
    return { topics: true, orphans: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }
  } catch {
    return { topics: true, orphans: true }
  }
}

/** A colour token as a usable CSS colour. */
function token(name: string, alpha = 1): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return alpha === 1 ? `hsl(${v})` : `hsl(${v} / ${alpha})`
}

export function BrainGraph({ onOpen }: { onOpen: (noteId: string) => void }): JSX.Element {
  const notes = useAppStore((s) => s.brainNotes)
  const topics = useAppStore((s) => s.brainTopics)
  const filter = useBrainUiStore((s) => s.filter)
  const search = useBrainUiStore((s) => s.search)
  const setFilter = useBrainUiStore((s) => s.setFilter)

  const [prefs, setPrefs] = useState(readPrefs)
  const togglePref = (key: 'topics' | 'orphans'): void =>
    setPrefs((p) => {
      const next = { ...p, [key]: !p[key] }
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      } catch {
        /* only a preference */
      }
      return next
    })

  // ---- The graph's shape ----------------------------------------------------
  const graph = useMemo(() => {
    const byTitle = notesByTitle(notes)
    const topicById = new Map(topics.map((t) => [t.id, t]))
    const links: GLink[] = []
    const degree = new Map<string, number>()
    const bump = (id: string): void => void degree.set(id, (degree.get(id) ?? 0) + 1)

    const seen = new Set<string>()
    for (const note of notes) {
      for (const title of linksIn(note.body)) {
        const target = byTitle.get(titleKey(title))
        if (!target || target.id === note.id) continue
        // One line per pair, however many times and in whichever direction they link.
        const pair = [note.id, target.id].sort().join('|')
        if (seen.has(pair)) continue
        seen.add(pair)
        links.push({ source: note.id, target: target.id, kind: 'link' })
        bump(note.id)
        bump(target.id)
      }
    }

    const nodes: GNode[] = []
    for (const note of notes) {
      const linked = (degree.get(note.id) ?? 0) > 0
      const inTopic = prefs.topics && note.topics.some((t) => topicById.has(t))
      if (!prefs.orphans && !linked && !inTopic) continue
      const first = note.topics.map((t) => topicById.get(t)).find(Boolean)
      nodes.push({
        id: note.id,
        kind: 'note',
        label: note.title || 'Sem título',
        color: first?.color,
        r: 3.5 + Math.sqrt(degree.get(note.id) ?? 0) * 2.2
      })
    }
    const shown = new Set(nodes.map((n) => n.id))
    const visibleLinks = links.filter(
      (l) => shown.has(l.source as string) && shown.has(l.target as string)
    )

    if (prefs.topics) {
      for (const topic of topics) {
        const members = notes.filter((n) => shown.has(n.id) && n.topics.includes(topic.id))
        if (members.length === 0) continue
        nodes.push({
          id: `topic:${topic.id}`,
          kind: 'topic',
          label: topic.name,
          color: topic.color,
          r: 7 + Math.sqrt(members.length) * 1.6
        })
        for (const m of members)
          visibleLinks.push({ source: `topic:${topic.id}`, target: m.id, kind: 'topic' })
      }
    }
    return { nodes, links: visibleLinks }
  }, [notes, topics, prefs.topics, prefs.orphans])

  // Who touches whom, for lighting up neighbours.
  const neighbours = useMemo(() => {
    const map = new Map<string, Set<string>>()
    const add = (a: string, b: string): void => {
      if (!map.has(a)) map.set(a, new Set())
      map.get(a)!.add(b)
    }
    for (const l of graph.links) {
      add(l.source as string, l.target as string)
      add(l.target as string, l.source as string)
    }
    return map
  }, [graph])

  // What the sidebar or the search points at — the rest fades back.
  const focusIds = useMemo<Set<string> | null>(() => {
    if (search.trim()) return new Set(notes.filter((n) => noteMatches(n, search)).map((n) => n.id))
    if (filter.startsWith('topic:')) {
      const id = filter.slice(6)
      return new Set([
        `topic:${id}`,
        ...notes.filter((n) => n.topics.includes(id)).map((n) => n.id)
      ])
    }
    if (filter === 'inbox') return new Set(notes.filter((n) => n.inbox).map((n) => n.id))
    if (filter === 'pinned') return new Set(notes.filter((n) => n.pinned).map((n) => n.id))
    return null
  }, [filter, search, notes])

  // ---- Canvas, physics and view ---------------------------------------------
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<Simulation<GNode, GLink> | null>(null)
  const nodesRef = useRef<GNode[]>([])
  const linksRef = useRef<GLink[]>([])
  const view = useRef({ x: 0, y: 0, k: 1 })
  const size = useRef({ w: 0, h: 0 })
  const hover = useRef<GNode | null>(null)
  const frame = useRef(0)
  const fitted = useRef(false)
  const live = useRef({ neighbours, focusIds })
  live.current = { neighbours, focusIds }

  const draw = (): void => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(paint)
  }

  function paint(): void {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { w, h } = size.current
    const dpr = window.devicePixelRatio || 1
    const { x, y, k } = view.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const hovered = hover.current
    const near = hovered ? live.current.neighbours.get(hovered.id) : undefined
    const focus = live.current.focusIds
    const lit = (n: GNode): boolean =>
      hovered ? n === hovered || !!near?.has(n.id) : focus ? focus.has(n.id) : true

    const fg = token('--foreground')
    const muted = token('--muted-foreground')
    const primary = token('--primary')
    const toScreen = (n: GNode): [number, number] => [(n.x ?? 0) * k + x, (n.y ?? 0) * k + y]

    // Lines first, under the dots.
    for (const l of linksRef.current) {
      const s = l.source as GNode
      const t = l.target as GNode
      const on = lit(s) && lit(t)
      const [sx, sy] = toScreen(s)
      const [tx, ty] = toScreen(t)
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(tx, ty)
      if (l.kind === 'topic') {
        ctx.strokeStyle = token('--border', on ? 0.9 : 0.25)
        ctx.lineWidth = 1
      } else {
        ctx.strokeStyle = hovered && on ? primary : token('--muted-foreground', on ? 0.55 : 0.12)
        ctx.lineWidth = hovered && on ? 1.8 : 1.2
      }
      ctx.stroke()
    }

    const labels: { n: GNode; sx: number; sy: number; priority: number }[] = []
    for (const n of nodesRef.current) {
      const [sx, sy] = toScreen(n)
      const r = n.r * Math.max(0.6, Math.min(k, 1.6))
      const on = lit(n)
      ctx.globalAlpha = on ? 1 : 0.18
      ctx.beginPath()
      ctx.arc(sx, sy, r, 0, Math.PI * 2)
      if (n.kind === 'topic') {
        ctx.fillStyle = `hsl(${n.color} / 0.22)`
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = `hsl(${n.color})`
        ctx.stroke()
      } else {
        ctx.fillStyle = n.color ? `hsl(${n.color})` : muted
        ctx.fill()
        if (n === hovered) {
          ctx.lineWidth = 2
          ctx.strokeStyle = fg
          ctx.stroke()
        }
      }

      // Names: topics always; notes when zoomed in, lit up, or found.
      const named =
        n.kind === 'topic' ||
        n === hovered ||
        (hovered && near?.has(n.id)) ||
        (!hovered && focus?.has(n.id)) ||
        k >= 1.5
      if (named && on) {
        const priority =
          n === hovered ? 1e6 : n.kind === 'topic' ? 1e5 + n.r : near?.has(n.id) ? 1e3 + n.r : n.r
        labels.push({ n, sx, sy: sy + r + 4, priority })
      }
      ctx.globalAlpha = 1
    }

    /*
      Names last, over every dot and line, and never on top of each other.
      The most important go first — the note under the mouse, the topics,
      then the notes with most links — and a name that would overlap one
      already written is skipped. Zooming in spreads the dots apart, so the
      skipped names come back on their own. Far out, names are shorter.
    */
    const max = k < 0.8 ? 20 : k < 1.3 ? 28 : 42
    const placed: { x: number; y: number; w: number; h: number }[] = []
    const overlaps = (b: { x: number; y: number; w: number; h: number }): boolean =>
      placed.some((p) => b.x < p.x + p.w && b.x + b.w > p.x && b.y < p.y + p.h && b.y + b.h > p.y)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (const { n, sx, sy } of labels.sort((a, b) => b.priority - a.priority)) {
      const isHovered = n === hovered
      const limit = isHovered ? 80 : max
      const text = n.label.length > limit ? `${n.label.slice(0, limit - 1).trimEnd()}…` : n.label
      ctx.font =
        n.kind === 'topic'
          ? '600 12px Inter, system-ui, sans-serif'
          : `${isHovered ? 600 : 500} 11px Inter, system-ui, sans-serif`
      const w = ctx.measureText(text).width
      const box = { x: sx - w / 2 - 5, y: sy - 2, w: w + 10, h: 17 }
      if (!isHovered && overlaps(box)) continue
      placed.push(box)

      // A dark pill behind the name, so it reads over the lines.
      ctx.fillStyle = token('--background', isHovered ? 0.92 : 0.72)
      ctx.beginPath()
      ctx.roundRect(box.x, box.y, box.w, box.h, 5)
      ctx.fill()
      ctx.fillStyle =
        n.kind === 'topic' ? `hsl(${n.color})` : isHovered ? fg : token('--foreground', 0.85)
      ctx.fillText(text, sx, sy + 1)
    }
  }

  /** Zoom and move so every dot fits on screen. */
  const fit = (): void => {
    const ns = nodesRef.current
    const { w, h } = size.current
    if (ns.length === 0 || w === 0) return
    const xs = ns.map((n) => n.x ?? 0)
    const ys = ns.map((n) => n.y ?? 0)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const k = Math.max(
      0.2,
      Math.min(2.2, Math.min((w - 120) / (maxX - minX || 1), (h - 120) / (maxY - minY || 1)))
    )
    view.current = { k, x: w / 2 - ((minX + maxX) / 2) * k, y: h / 2 - ((minY + maxY) / 2) * k }
    draw()
  }

  // Rebuild the physics when the shape changes, keeping dots where they were.
  useEffect(() => {
    const previous = new Map(nodesRef.current.map((n) => [n.id, n]))
    const nodes = graph.nodes.map((n) => {
      const old = previous.get(n.id)
      return old ? { ...n, x: old.x, y: old.y, vx: old.vx, vy: old.vy } : { ...n }
    })
    const links = graph.links.map((l) => ({ ...l }))
    nodesRef.current = nodes
    linksRef.current = links

    simRef.current?.stop()
    const sim = forceSimulation<GNode, GLink>(nodes)
      .force(
        'link',
        forceLink<GNode, GLink>(links)
          .id((d) => d.id)
          .distance((l) => (l.kind === 'topic' ? 70 : 55))
          .strength((l) => (l.kind === 'topic' ? 0.35 : 0.6))
      )
      .force(
        'charge',
        forceManyBody<GNode>().strength((d) => (d.kind === 'topic' ? -320 : -60))
      )
      .force(
        'collide',
        forceCollide<GNode>((d) => d.r + 3)
      )
      .force('center', forceCenter(0, 0))
      // A light pull inwards, so loose notes don't drift off the map.
      .force('x', forceX(0).strength(0.04))
      .force('y', forceY(0).strength(0.04))
      .on('tick', draw)
    simRef.current = sim

    if (!fitted.current) {
      // Settle before the first frame, so it opens calm and framed.
      sim.alpha(1)
      for (let i = 0; i < 220; i++) sim.tick()
      fitted.current = true
      fit()
      sim.alpha(0.05)
    } else {
      sim.alpha(0.4)
    }
    sim.restart()
    return () => {
      sim.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph])

  // Repaint when what is highlighted changes.
  useEffect(draw, [focusIds, neighbours])

  // Keep the canvas the size of its box, sharp on any screen.
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const observer = new ResizeObserver(() => {
      const { width, height } = wrap.getBoundingClientRect()
      const first = size.current.w === 0
      size.current = { w: width, h: height }
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      if (first) fit()
      else draw()
    })
    observer.observe(wrap)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Pointer --------------------------------------------------------------
  const toWorld = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const { x, y, k } = view.current
    return [(e.clientX - rect.left - x) / k, (e.clientY - rect.top - y) / k]
  }

  const nodeAt = (e: { clientX: number; clientY: number }): GNode | null => {
    const [wx, wy] = toWorld(e)
    const k = view.current.k
    let best: GNode | null = null
    let bestD = Infinity
    for (const n of nodesRef.current) {
      const d = Math.hypot((n.x ?? 0) - wx, (n.y ?? 0) - wy)
      const reach = (n.r * Math.max(0.6, Math.min(k, 1.6))) / k + 4 / k
      if (d < reach && d < bestD) {
        best = n
        bestD = d
      }
    }
    return best
  }

  const drag = useRef<{
    node: GNode | null
    startX: number
    startY: number
    viewX: number
    viewY: number
    moved: boolean
  } | null>(null)
  const [cursor, setCursor] = useState('grab')

  const onPointerDown = (e: React.PointerEvent): void => {
    const node = nodeAt(e)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = {
      node,
      startX: e.clientX,
      startY: e.clientY,
      viewX: view.current.x,
      viewY: view.current.y,
      moved: false
    }
    if (node) {
      node.fx = node.x
      node.fy = node.y
      simRef.current?.alphaTarget(0.25).restart()
    }
    setCursor('grabbing')
  }

  const onPointerMove = (e: React.PointerEvent): void => {
    const d = drag.current
    if (!d) {
      const node = nodeAt(e)
      if (node !== hover.current) {
        hover.current = node
        setCursor(node ? 'pointer' : 'grab')
        draw()
      }
      return
    }
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 3) d.moved = true
    if (d.node) {
      const [wx, wy] = toWorld(e)
      d.node.fx = wx
      d.node.fy = wy
    } else {
      view.current = {
        ...view.current,
        x: d.viewX + e.clientX - d.startX,
        y: d.viewY + e.clientY - d.startY
      }
      draw()
    }
  }

  const onPointerUp = (): void => {
    const d = drag.current
    drag.current = null
    setCursor(hover.current ? 'pointer' : 'grab')
    if (!d) return
    if (d.node) {
      d.node.fx = null
      d.node.fy = null
      simRef.current?.alphaTarget(0)
    }
    if (d.moved || !d.node) return
    // A click, not a drag: a note opens, a topic narrows the map to it.
    if (d.node.kind === 'note') onOpen(d.node.id)
    else setFilter(d.node.id as `topic:${string}`)
  }

  const onWheel = (e: React.WheelEvent): void => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const { x, y, k } = view.current
    const next = Math.max(0.15, Math.min(5, k * Math.exp(-e.deltaY * 0.0015)))
    // Zoom around the pointer, so what is under it stays under it.
    view.current = { k: next, x: px - ((px - x) / k) * next, y: py - ((py - y) / k) * next }
    draw()
  }

  const noteCount = graph.nodes.filter((n) => n.kind === 'note').length
  const linkCount = graph.links.filter((l) => l.kind === 'link').length

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          if (!drag.current && hover.current) {
            hover.current = null
            draw()
          }
        }}
        onWheel={onWheel}
        style={{ cursor }}
        className="no-drag block touch-none"
      />

      {/* Controls */}
      <div className="absolute right-4 top-4 flex items-center gap-1 rounded-xl border border-border/70 bg-surface-elevated/90 p-1 backdrop-blur">
        <MapToggle
          on={prefs.topics}
          onClick={() => togglePref('topics')}
          icon={Tag}
          label="Tópicos como núcleos"
        />
        <MapToggle
          on={prefs.orphans}
          onClick={() => togglePref('orphans')}
          icon={Unlink}
          label="Notas soltas"
        />
        <span className="mx-0.5 h-4 w-px bg-border" />
        <button
          onClick={fit}
          title="Enquadrar tudo"
          className="no-drag flex h-7 items-center gap-1.5 rounded-lg px-2 text-[11px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <Crosshair className="h-3.5 w-3.5" /> Centralizar
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-background/70 px-2.5 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
        {noteCount} notas · {linkCount} ligações · arraste para mover · roda do mouse para zoom ·
        clique abre
      </div>

      {noteCount > 0 && linkCount === 0 && (
        <div className="pointer-events-none absolute bottom-4 right-4 max-w-[45%] rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary">
          Nenhuma ligação ainda — dentro de uma nota, digite [[ para ligar a outra.
        </div>
      )}
    </div>
  )
}

function MapToggle({
  on,
  onClick,
  icon: Icon,
  label
}: {
  on: boolean
  onClick: () => void
  icon: typeof Tag
  label: string
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'no-drag flex h-7 items-center gap-1.5 rounded-lg px-2 text-[11px] transition-colors',
        on
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  )
}
