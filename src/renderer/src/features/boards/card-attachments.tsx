import { useState } from 'react'
import {
  Cloud,
  Download,
  File,
  FileAudio,
  FileImage,
  FileText,
  HardDrive,
  Loader2,
  Upload,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToastStore } from '@/stores/toast-store'
import type { Board, BoardCard, CardAttachment } from '@shared/types'

const AUDIO = /\.(mp3|wav|m4a|ogg|flac|aac)$/i
const IMAGE = /\.(png|jpe?g|webp|gif|bmp)$/i
const TEXT = /\.(txt|srt|md|doc|docx|pdf)$/i

function iconFor(name: string): typeof File {
  if (AUDIO.test(name)) return FileAudio
  if (IMAGE.test(name)) return FileImage
  if (TEXT.test(name)) return FileText
  return File
}

function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** "some em 1d 20h" — how long a cloud file has left before the sweep takes it. */
function expiresLabel(iso: string): string {
  const ms = Date.parse(iso) - Date.now()
  if (ms <= 0) return 'saindo da nuvem'
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 24) return `some em ${Math.floor(hours / 24)}d ${hours % 24}h`
  if (hours >= 1) return `some em ${hours}h`
  return `some em ${Math.max(1, Math.round(ms / 60_000))} min`
}

/**
 * Files on a card — the audio, the thumbnail, the notes — under the Assets
 * text. On a shared board they live in the cloud for two days so the other
 * person can download them; on a board only on this PC they stay where they
 * are and open from there.
 */
export function CardAttachments({ card, board }: { card: BoardCard; board: Board }): JSX.Element {
  const pushToast = useToastStore((s) => s.push)
  const [busy, setBusy] = useState<'attach' | 'download' | null>(null)
  const files = card.attachments ?? []
  const shared = Boolean(board.shared)

  const attach = async (): Promise<void> => {
    setBusy('attach')
    const res = await window.focusHub.attachFiles(card.id)
    setBusy(null)
    if (res.ok) {
      pushToast({
        title: shared
          ? `${res.count} arquivo(s) enviado(s)`
          : `${res.count} arquivo(s) anexado(s)`,
        lines: shared ? ['Ficam na nuvem por 2 dias e depois somem sozinhos.'] : undefined,
        variant: 'success'
      })
    } else if (res.error) {
      pushToast({ title: 'Não deu para anexar', lines: [res.error], variant: 'warning' })
    }
  }

  const download = async (attachmentId?: string): Promise<void> => {
    setBusy('download')
    const res = await window.focusHub.downloadAttachments(card.id, attachmentId)
    setBusy(null)
    if (!res.ok && res.error) {
      pushToast({ title: 'Não deu para baixar', lines: [res.error], variant: 'warning' })
    }
  }

  return (
    <div className="mt-2 space-y-1.5">
      {files.map((file) => (
        <AttachmentRow
          key={file.id}
          file={file}
          disabled={busy !== null}
          onOpen={() => void download(file.id)}
          onRemove={() => void window.focusHub.removeAttachment(card.id, file.id)}
        />
      ))}

      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          onClick={() => void attach()}
          disabled={busy !== null}
        >
          {busy === 'attach' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {busy === 'attach' ? (shared ? 'Enviando…' : 'Anexando…') : 'Anexar arquivos'}
        </Button>
        {files.length > 1 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void download()}
            disabled={busy !== null}
          >
            {busy === 'download' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Baixar todos
          </Button>
        )}
      </div>

      {shared && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Neste quadro compartilhado, os arquivos sobem para a nuvem e somem 2 dias depois.
          Baixados, vão para Downloads › Focus HUB.
        </p>
      )}
    </div>
  )
}

function AttachmentRow({
  file,
  disabled,
  onOpen,
  onRemove
}: {
  file: CardAttachment
  disabled: boolean
  onOpen: () => void
  onRemove: () => void
}): JSX.Element {
  const Icon = iconFor(file.name)
  const inCloud = Boolean(file.storagePath)
  return (
    <div className="group flex items-center gap-2 rounded-lg border border-border/60 bg-surface/40 px-2 py-1.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs" title={file.name}>
          {file.name}
        </p>
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {inCloud ? <Cloud className="h-2.5 w-2.5" /> : <HardDrive className="h-2.5 w-2.5" />}
          {sizeLabel(file.size)} ·{' '}
          {inCloud && file.expiresAt ? expiresLabel(file.expiresAt) : 'neste PC'}
        </p>
      </div>
      <button
        onClick={onOpen}
        disabled={disabled}
        className="no-drag shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-40"
        title={inCloud ? 'Baixar' : 'Abrir'}
      >
        {inCloud ? <Download className="h-3.5 w-3.5" /> : <File className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={onRemove}
        disabled={disabled}
        className="no-drag shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100 disabled:opacity-40"
        title="Remover anexo"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
