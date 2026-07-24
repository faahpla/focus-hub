import { useRef } from 'react'
import { TitleBar } from './title-bar'
import { Sidebar } from './sidebar'
import { QuickCaptureButton } from '@/features/quick-capture/quick-capture-button'
import { YoutubePlayer } from '@/features/music/youtube-player'
import { Toaster } from '@/components/toaster'

export function AppShell({ children }: { children: React.ReactNode }): JSX.Element {
  const dragBoundsRef = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={dragBoundsRef}
      className="relative flex h-screen flex-col overflow-hidden bg-background"
    >
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative min-w-0 flex-1 overflow-y-auto scrollbar-thin">{children}</main>
      </div>
      <QuickCaptureButton />
      <YoutubePlayer dragBoundsRef={dragBoundsRef} />
      <Toaster />
    </div>
  )
}
