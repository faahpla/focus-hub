import { useEffect } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppShell } from '@/components/layout/app-shell'
import { UltraFocusOverlay } from '@/features/session/ultra-focus-overlay'
import { SessionReportOverlay } from '@/features/session/session-report'
import { HomePage } from '@/features/home/home-page'
import { TodayPage } from '@/features/planner/pages/today-page'
import { AgendaPage } from '@/features/planner/pages/agenda-page'
import { HabitsPage } from '@/features/planner/pages/habits-page'
import { ProjectsPage } from '@/features/projects/projects-page'
import { BoardsPage } from '@/features/boards/boards-page'
import { IdeasPage } from '@/features/ideas/ideas-page'
import { FinancePage } from '@/features/finance/finance-page'
import { StatsPage } from '@/features/stats/stats-page'
import { SettingsPage } from '@/features/settings/settings-page'
import { QuickCapturePage } from '@/features/quick-capture/quick-capture-page'
import { useAppStore } from '@/stores/app-store'
import { useSessionStore } from '@/stores/session-store'
import { useToastStore } from '@/stores/toast-store'
import { useThemeEffect } from '@/hooks/use-theme'

export default function App(): JSX.Element {
  const location = useLocation()
  const isQuickCapture = location.pathname.startsWith('/quick-capture')

  if (isQuickCapture) {
    return <QuickCapturePage />
  }
  return <MainApp />
}

function MainApp(): JSX.Element {
  const init = useAppStore((s) => s.init)
  const loaded = useAppStore((s) => s.loaded)
  const navigate = useNavigate()
  const togglePause = useSessionStore((s) => s.togglePause)
  useThemeEffect()

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    const offTray = window.focusHub.onTrayNewSession(() => navigate('/'))
    const offPause = window.focusHub.onGlobalTogglePause(() => togglePause())
    // Announce a ready update once — otherwise it only surfaces in Settings.
    const offUpdate = window.focusHub.onUpdateStatus((status) => {
      if (status.state !== 'downloaded') return
      useToastStore.getState().push({
        title: `Atualização ${status.version} pronta`,
        lines: ['Vá em Ajustes › Atualizações para reiniciar e instalar.'],
        variant: 'success',
        duration: 10000
      })
    })
    return () => {
      offTray()
      offPause()
      offUpdate()
    }
  }, [navigate, togglePause])

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <AppShell>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/habitos" element={<HabitsPage />} />
          {/* The old home: the full-screen timer with ambient sound, Flow mode
              and the checklist. Reached from "Modo foco" in the timer panel. */}
          <Route path="/foco" element={<HomePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/boards" element={<BoardsPage />} />
          <Route path="/ideas" element={<IdeasPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
      <UltraFocusOverlay />
      <SessionReportOverlay />
    </TooltipProvider>
  )
}
