import { useState } from 'react'
import { Loader2, Ticket } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSyncStore } from '@/stores/sync-store'
import { useToastStore } from '@/stores/toast-store'
import { AccountForm } from './account-form'

/**
 * The other side of sharing: someone got a code and wants the board. Signs
 * them in first if they are not yet, so the whole path is one dialog.
 */
export function JoinDialog({
  onClose,
  onJoined
}: {
  onClose: () => void
  onJoined: (boardId: string) => void
}): JSX.Element {
  const status = useSyncStore((s) => s.status)
  const pushToast = useToastStore((s) => s.push)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const join = async (): Promise<void> => {
    if (busy || !code.trim()) return
    setBusy(true)
    setError(null)
    const res = await window.focusHub.joinBoard(code)
    setBusy(false)
    if (!res.ok || !res.boardId) {
      setError(res.error ?? 'Não deu certo. Tente de novo.')
      return
    }
    pushToast({
      title: `Você entrou em “${res.boardName ?? 'quadro compartilhado'}”`,
      lines: ['O que vocês mudarem aparece para os dois em segundos.'],
      variant: 'success'
    })
    onJoined(res.boardId)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrar com código</DialogTitle>
          <DialogDescription>
            Use o código que o dono do quadro te mandou. Ele vale uma vez só.
          </DialogDescription>
        </DialogHeader>

        {status.state === 'unconfigured' ? (
          <p className="text-sm text-muted-foreground">
            Esta cópia do Focus HUB foi gerada sem a conexão com o servidor, então não dá para
            entrar em quadros compartilhados nela.
          </p>
        ) : status.state === 'signed-out' ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Primeiro, entre na sua conta — ou crie uma, se é sua primeira vez.
            </p>
            <AccountForm />
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && void join()}
              placeholder="XXXX-XXXX-XXXX"
              className="font-mono text-base tracking-[0.15em]"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button
              variant="primary"
              className="w-full"
              onClick={() => void join()}
              disabled={busy || !code.trim()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
              Entrar no quadro
            </Button>
            {status.email && (
              <p className="text-center text-[11px] text-muted-foreground">
                Entrando como {status.email}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
