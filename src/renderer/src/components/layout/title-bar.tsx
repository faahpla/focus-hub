import { useEffect, useState } from 'react'
import { Camera, Minus, ShieldAlert, Square, X } from 'lucide-react'
import { useToastStore } from '@/stores/toast-store'
import { cn } from '@/lib/utils'

export function TitleBar(): JSX.Element {
  const push = useToastStore((s) => s.push)
  const [elevated, setElevated] = useState(false)

  // Running as administrator is invisible and has real consequences: Windows
  // blocks the Snipping Tool over the window, and a normal launch can't bring
  // this one back. Say so where it can't be missed.
  useEffect(() => {
    let alive = true
    window.focusHub.getAppInfo().then((i) => alive && setElevated(i.elevated))
    return () => {
      alive = false
    }
  }, [])

  /*
    Screenshot the app from inside the app.

    Windows' own capture tools rely on a full-screen overlay that, on some
    machines, never appears while this window has focus — leaving no way to
    grab a picture of the app at all. This asks the window for its own pixels
    instead, so it does not depend on the desktop cooperating.
  */
  const capture = async (): Promise<void> => {
    const file = await window.focusHub.captureWindow()
    if (file) {
      push({
        title: 'Print copiado',
        lines: ['Já está na área de transferência — Ctrl+V para colar.', `Salvo em ${file}`],
        variant: 'success',
        duration: 7000
      })
    } else {
      push({ title: 'Não consegui capturar a tela', variant: 'warning' })
    }
  }

  // Ctrl+Shift+S, registered inside the app only — never stolen system-wide.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void capture()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="drag flex h-10 shrink-0 items-center justify-between pl-4 pr-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-glow" />
        Focus HUB
        {elevated && (
          <button
            onClick={() => window.focusHub.relaunchNormal()}
            title="Rodando como administrador. Assim o Windows não deixa a Ferramenta de Recorte aparecer sobre o app, e abrir pelo atalho não traz esta janela de volta. Clique para fechar e reabrir normalmente."
            className="no-drag flex items-center gap-1 rounded-md border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-400 transition-colors hover:bg-orange-500/20"
          >
            <ShieldAlert className="h-3 w-3" />
            admin
          </button>
        )}
      </div>
      <div className="no-drag flex items-center gap-1">
        <WinButton
          onClick={() => void capture()}
          aria-label="Capturar tela do app"
          title="Capturar tela do app (Ctrl+Shift+S)"
        >
          <Camera className="h-3.5 w-3.5" />
        </WinButton>
        <WinButton onClick={() => window.focusHub.minimize()} aria-label="Minimizar">
          <Minus className="h-3.5 w-3.5" />
        </WinButton>
        <WinButton onClick={() => window.focusHub.toggleMaximize()} aria-label="Maximizar">
          <Square className="h-3 w-3" />
        </WinButton>
        <WinButton
          onClick={() => window.focusHub.close()}
          aria-label="Fechar"
          className="hover:bg-destructive/90 hover:text-destructive-foreground"
        >
          <X className="h-4 w-4" />
        </WinButton>
      </div>
    </div>
  )
}

function WinButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element {
  return (
    <button
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground',
        className
      )}
      {...props}
    />
  )
}
