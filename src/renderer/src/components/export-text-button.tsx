import { useState } from 'react'
import { Check, FileDown } from 'lucide-react'
import { useToastStore } from '@/stores/toast-store'
import { toPlainText } from '@/lib/rich-text'
import { cn } from '@/lib/utils'

/**
 * Save text as a .txt in Downloads › Focus HUB › <folder>, and say where.
 * Formatted text goes out clean — the reader of a .txt sees no markup.
 */
export async function exportTextFile(folder: string, name: string, text: string): Promise<boolean> {
  const push = useToastStore.getState().push
  const res = await window.focusHub.exportText(folder, name, toPlainText(text))
  if (res.ok && res.path) {
    const path = res.path
    push({
      title: `${path.split(/[\\/]/).pop()} salvo`,
      lines: [`Downloads › Focus HUB › ${path.split(/[\\/]/).slice(-2, -1)[0]}`],
      hint: 'Clique para mostrar na pasta',
      onClick: () => window.focusHub.revealExport(path),
      variant: 'success',
      duration: 7000
    })
    return true
  }
  push({ title: 'Não deu para exportar', lines: res.error ? [res.error] : undefined, variant: 'warning' })
  return false
}

/** The ".txt" next to a field's "Copiar". */
export function ExportTextButton({
  folder,
  name,
  value,
  className
}: {
  /** The folder under Downloads › Focus HUB — the card's title. */
  folder: string
  /** The file's name, without ".txt": the field's label. */
  name: string
  value: string
  className?: string
}): JSX.Element {
  const [saved, setSaved] = useState(false)
  const empty = !toPlainText(value).trim()
  return (
    <button
      onClick={async () => {
        if (empty) return
        if (await exportTextFile(folder, name, value)) {
          setSaved(true)
          setTimeout(() => setSaved(false), 1400)
        }
      }}
      disabled={empty}
      title={`Exportar como ${name}.txt`}
      className={cn(
        'no-drag flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-30',
        className
      )}
    >
      {saved ? <Check className="h-3 w-3 text-success" /> : <FileDown className="h-3 w-3" />}
      .txt
    </button>
  )
}
