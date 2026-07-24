import { useState } from 'react'
import { Lightbulb } from 'lucide-react'

/**
 * Rendered inside the dedicated frameless always-on-top window opened by the
 * global shortcut / tray. Saves through the main process directly and closes.
 */
export function QuickCapturePage(): JSX.Element {
  const [value, setValue] = useState('')

  const submit = async (): Promise<void> => {
    const content = value.trim()
    if (content) await window.focusHub.saveQuickIdea(content)
    window.focusHub.closeQuickCapture()
  }

  return (
    <div className="drag flex h-screen items-center justify-center bg-transparent p-3">
      <div className="glass w-full rounded-2xl p-4 shadow-elevated animate-scale-in">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Lightbulb className="h-3.5 w-3.5 text-primary" />
          Capturar ideia · Enter salva · Esc cancela
        </div>
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit()
            }
            if (e.key === 'Escape') window.focusHub.closeQuickCapture()
          }}
          placeholder="Escreva e pressione Enter…"
          className="no-drag h-20 w-full resize-none bg-transparent text-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        />
      </div>
    </div>
  )
}
