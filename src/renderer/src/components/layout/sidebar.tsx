import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  Brain,
  CalendarDays,
  Flame,
  FolderKanban,
  Home,
  KanbanSquare,
  MonitorPlay,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Wallet,
  type LucideIcon
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { useAppStore } from '@/stores/app-store'

interface Item {
  to: string
  icon: LucideIcon
  label: string
}

/** Grouped by what the day is about: the work first, the rest after. */
const GROUPS: { title?: string; items: Item[] }[] = [
  {
    items: [
      { to: '/', icon: Home, label: 'Hoje' },
      { to: '/agenda', icon: CalendarDays, label: 'Agenda' }
    ]
  },
  {
    title: 'Produção',
    items: [
      { to: '/boards', icon: KanbanSquare, label: 'Quadros' },
      { to: '/brain', icon: Brain, label: 'Brain' },
      { to: '/canais', icon: MonitorPlay, label: 'Canais' }
    ]
  },
  {
    title: 'Você',
    items: [
      { to: '/habitos', icon: Flame, label: 'Hábitos e metas' },
      { to: '/finance', icon: Wallet, label: 'Finance HUB' },
      { to: '/stats', icon: BarChart3, label: 'Estatísticas' }
    ]
  }
]

/** Used less: at the bottom, out of the way. */
const FOOTER: Item[] = [
  { to: '/projects', icon: FolderKanban, label: 'Projetos' },
  { to: '/settings', icon: Settings, label: 'Ajustes' }
]

const COLLAPSED_KEY = 'focus-hub:sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function Sidebar(): JSX.Element {
  const level = useAppStore((s) => s.stats.level)
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const toggle = (): void => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1')
      } catch {
        /* only a convenience */
      }
      return !c
    })
  }

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-border/60 py-3 transition-[width] duration-200',
        collapsed ? 'w-[68px] items-center' : 'w-[208px] px-3'
      )}
    >
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto pt-2 scrollbar-thin">
        {GROUPS.map((group, i) => (
          <div key={i} className="flex flex-col gap-1">
            {group.title &&
              (collapsed ? (
                <div className="mx-auto mb-1 h-px w-6 bg-border/80" />
              ) : (
                <p className="mb-0.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.title}
                </p>
              ))}
            {group.items.map((item) => (
              <NavItem key={item.to} item={item} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-border/60 pt-3">
        {FOOTER.map((item) => (
          <NavItem key={item.to} item={item} collapsed={collapsed} />
        ))}
        <div
          className={cn(
            'mt-2 flex items-center gap-2',
            collapsed ? 'flex-col' : 'justify-between px-1'
          )}
        >
          <Tooltip label={`Nível ${level}`} side="right">
            <div className="no-drag flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {level}
            </div>
          </Tooltip>
          <Tooltip label={collapsed ? 'Mostrar nomes' : 'Recolher barra'} side="right">
            <button
              onClick={toggle}
              className="no-drag flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </Tooltip>
        </div>
      </div>
    </aside>
  )
}

function NavItem({ item, collapsed }: { item: Item; collapsed: boolean }): JSX.Element {
  const link = (
    <NavLink to={item.to} end={item.to === '/'} className="no-drag block">
      {({ isActive }) => (
        <div
          className={cn(
            'relative flex h-10 items-center rounded-xl text-muted-foreground transition-colors',
            collapsed ? 'w-11 justify-center' : 'gap-3 px-3',
            isActive ? 'text-foreground' : 'hover:bg-surface-hover hover:text-foreground'
          )}
        >
          {isActive && (
            <motion.div
              layoutId="nav-active"
              className="absolute inset-0 rounded-xl border border-border/80 bg-surface-elevated"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )}
          <item.icon
            className={cn('relative h-5 w-5 shrink-0', isActive && 'text-primary')}
            strokeWidth={2}
          />
          {!collapsed && (
            <span className="relative truncate text-sm font-medium">{item.label}</span>
          )}
        </div>
      )}
    </NavLink>
  )
  return collapsed ? (
    <Tooltip label={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  )
}
