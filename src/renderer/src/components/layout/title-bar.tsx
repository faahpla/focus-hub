import { Minus, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TitleBar(): JSX.Element {
  return (
    <div className="drag flex h-10 shrink-0 items-center justify-between pl-4 pr-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-glow" />
        Focus HUB
      </div>
      <div className="no-drag flex items-center gap-1">
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
