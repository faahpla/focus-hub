import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  FolderKanban,
  Home,
  KanbanSquare,
  Lightbulb,
  Settings,
  Wallet
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { useAppStore } from '@/stores/app-store'

const NAV = [
  { to: '/', icon: Home, label: 'Início' },
  { to: '/projects', icon: FolderKanban, label: 'Projetos' },
  { to: '/boards', icon: KanbanSquare, label: 'Quadros' },
  { to: '/ideas', icon: Lightbulb, label: 'Ideias' },
  { to: '/finance', icon: Wallet, label: 'Finance HUB' },
  { to: '/stats', icon: BarChart3, label: 'Estatísticas' },
  { to: '/settings', icon: Settings, label: 'Ajustes' }
]

export function Sidebar(): JSX.Element {
  const level = useAppStore((s) => s.stats.level)
  return (
    <aside className="flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-border/60 py-3">
      <nav className="flex flex-1 flex-col items-center gap-1.5 pt-2">
        {NAV.map((item) => (
          <Tooltip key={item.to} label={item.label} side="right">
            <NavLink to={item.to} end={item.to === '/'} className="no-drag">
              {({ isActive }) => (
                <div
                  className={cn(
                    'relative flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors',
                    isActive ? 'text-foreground' : 'hover:bg-surface-hover hover:text-foreground'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-xl bg-surface-elevated border border-border/80"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  <item.icon className="relative h-5 w-5" strokeWidth={2} />
                </div>
              )}
            </NavLink>
          </Tooltip>
        ))}
      </nav>
      <Tooltip label={`Nível ${level}`} side="right">
        <div className="no-drag flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {level}
        </div>
      </Tooltip>
    </aside>
  )
}
