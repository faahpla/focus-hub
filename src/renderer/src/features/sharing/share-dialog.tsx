import { useCallback, useEffect, useState } from 'react'
import {
  Check,
  CloudOff,
  Copy,
  Loader2,
  LogOut,
  RefreshCw,
  Ticket,
  UserMinus,
  Users
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useSyncStore } from '@/stores/sync-store'
import { useToastStore } from '@/stores/toast-store'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Board } from '@shared/types'
import {
  FULL_PERMISSIONS,
  type BoardInvite,
  type BoardMember,
  type SharePermissions,
  type ShareRole
} from '@shared/sync'
import { AccountForm } from './account-form'
import { PermissionPicker, describeAccess } from './permission-picker'

/**
 * Everything about sharing one board, in one place: signing in if needed,
 * putting the board in the cloud, inviting people with a code, changing what
 * they may do, and taking it all back.
 */
export function ShareDialog({ board, onClose }: { board: Board; onClose: () => void }): JSX.Element {
  const status = useSyncStore((s) => s.status)
  const member = board.shared?.role === 'member'

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>
            {member ? `“${board.name}” é compartilhado com você` : `Compartilhar “${board.name}”`}
          </DialogTitle>
          <DialogDescription>
            {member
              ? 'O que um muda, o outro vê em segundos.'
              : 'Só este quadro vai para a nuvem. Finanças, sessões e os outros quadros ficam só no seu PC.'}
          </DialogDescription>
        </DialogHeader>

        {status.state === 'unconfigured' ? (
          <p className="text-sm text-muted-foreground">
            Esta cópia do Focus HUB foi gerada sem a conexão com o servidor, então o
            compartilhamento não está disponível nela.
          </p>
        ) : status.state === 'signed-out' ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Para compartilhar, entre na sua conta. É ela que guarda quem tem acesso a quê.
            </p>
            <AccountForm />
          </div>
        ) : (
          <div className="space-y-6">
            <ConnectionNote />
            {!board.shared && <StartSharing board={board} />}
            {board.shared?.role === 'owner' && <OwnerPanel board={board} onDone={onClose} />}
            {member && <MemberPanel board={board} onDone={onClose} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Offline or with edits waiting: say so, so nobody wonders why the other side lags. */
function ConnectionNote(): JSX.Element | null {
  const status = useSyncStore((s) => s.status)
  if (status.state === 'online' && status.pending === 0) return null
  const offline = status.state === 'offline'
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs',
        offline
          ? 'border-warning/30 bg-warning/10 text-warning'
          : 'border-border/70 bg-surface/40 text-muted-foreground'
      )}
    >
      {offline ? (
        <CloudOff className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
      )}
      {offline
        ? `Sem conexão. ${status.pending > 0 ? `${status.pending} mudança(s) esperando para subir.` : 'Você continua editando normalmente.'}`
        : status.pending > 0
          ? `Enviando ${status.pending} mudança(s)…`
          : 'Conectando…'}
    </div>
  )
}

function StartSharing({ board }: { board: Board }): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const share = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const res = await window.focusHub.shareBoard(board.id)
    setBusy(false)
    if (!res.ok) setError(res.error ?? 'Não deu certo. Tente de novo.')
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        <li>• O quadro e todos os cards dele sobem para a nuvem.</li>
        <li>• Você gera um código e manda para quem vai ter acesso.</li>
        <li>• Dá para mudar o acesso de alguém ou parar de compartilhar a qualquer hora.</li>
      </ul>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button variant="primary" className="w-full" onClick={() => void share()} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
        {busy ? 'Enviando o quadro…' : 'Compartilhar este quadro'}
      </Button>
    </div>
  )
}

/*
  People who already have access come first, and the invite form stays shut
  behind a button. With the form open on top it read as "this board's
  permissions": changing who may delete meant editing that form, which only
  shapes the next code and has no Save — the real control sat further down.
*/
function OwnerPanel({ board, onDone }: { board: Board; onDone: () => void }): JSX.Element {
  const [members, setMembers] = useState<BoardMember[] | null>(null)
  const [invites, setInvites] = useState<BoardInvite[]>([])
  const [inviting, setInviting] = useState<boolean | null>(null)

  const refresh = useCallback(() => {
    void window.focusHub.listMembers(board.id).then(setMembers)
    void window.focusHub.listInvites(board.id).then(setInvites)
  }, [board.id])
  useEffect(refresh, [refresh])

  // Nobody in yet: inviting is the only thing to do here, so open on it.
  const inviteOpen = inviting ?? (members !== null && members.length === 0)

  return (
    <>
      <Section title="Pessoas com acesso">
        {members === null ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : members.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Ninguém entrou ainda. Quando a pessoa usar o código, ela aparece aqui.
          </p>
        ) : (
          <div className="space-y-1.5">
            {members.map((m) => (
              <MemberRow key={m.userId} boardId={board.id} member={m} onChanged={refresh} />
            ))}
          </div>
        )}
      </Section>

      {inviteOpen ? (
        <InviteSection
          boardId={board.id}
          onCreated={refresh}
          onClose={members && members.length > 0 ? () => setInviting(false) : undefined}
        />
      ) : (
        <Button variant="secondary" className="w-full" onClick={() => setInviting(true)}>
          <Ticket className="h-4 w-4" /> Convidar outra pessoa
        </Button>
      )}

      {invites.length > 0 && (
        <Section title="Códigos ainda não usados">
          <div className="space-y-1.5">
            {invites.map((inv) => (
              <InviteRow key={inv.code} invite={inv} onChanged={refresh} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Parar de compartilhar">
        <p className="mb-2 text-xs text-muted-foreground">
          O quadro sai da nuvem e do PC de todo mundo que tem acesso. No seu, ele continua igual.
        </p>
        <ConfirmButton
          label="Parar de compartilhar"
          confirmLabel="Sim, tirar de todo mundo"
          onConfirm={async () => {
            const res = await window.focusHub.unshareBoard(board.id)
            if (res.ok) onDone()
            return res.error
          }}
        />
      </Section>
    </>
  )
}

function InviteSection({
  boardId,
  onCreated,
  onClose
}: {
  boardId: string
  onCreated: () => void
  /** Absent while nobody has joined: then inviting is the whole point of the dialog. */
  onClose?: () => void
}): JSX.Element {
  const [role, setRole] = useState<ShareRole>('editor')
  const [can, setCan] = useState<SharePermissions>({ ...FULL_PERMISSIONS })
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const res = await window.focusHub.createInvite(boardId, role, can)
    setBusy(false)
    if (res.ok && res.code) {
      setCode(res.code)
      onCreated()
    } else {
      setError(res.error ?? 'Não deu certo. Tente de novo.')
    }
  }

  return (
    <Section title="Convidar outra pessoa">
      {code ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
            <span className="font-mono text-xl font-semibold tracking-[0.15em]">{code}</span>
            <CopyCode value={code} />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Mande esse código para a pessoa (pelo WhatsApp, por exemplo). Ela instala o Focus HUB,
            cria a conta dela e usa <b>Quadros › Entrar com código</b>. Vale uma vez só, por 7 dias.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setCode(null)}>
            Gerar outro código
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            O acesso escolhido aqui vale só para quem usar o código novo. Para mudar o de quem já
            entrou, use <b>Mudar acesso</b> ao lado do nome da pessoa.
          </p>
          <PermissionPicker
            role={role}
            can={can}
            onChange={(r, c) => {
              setRole(r)
              setCan(c)
            }}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            {onClose && (
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
            )}
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => void create()}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
              Gerar código de convite
            </Button>
          </div>
        </div>
      )}
    </Section>
  )
}

function MemberRow({
  boardId,
  member,
  onChanged
}: {
  boardId: string
  member: BoardMember
  onChanged: () => void
}): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [role, setRole] = useState(member.role)
  const [can, setCan] = useState(member.can)
  const [busy, setBusy] = useState(false)
  const pushToast = useToastStore((s) => s.push)

  const save = async (): Promise<void> => {
    setBusy(true)
    const res = await window.focusHub.updateMember(boardId, member.userId, role, can)
    setBusy(false)
    if (!res.ok) {
      pushToast({ title: 'Não deu para mudar o acesso', lines: [res.error ?? ''], variant: 'warning' })
      return
    }
    setEditing(false)
    onChanged()
  }

  return (
    <div className="rounded-xl border border-border/70 bg-surface/40 p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{member.email}</p>
          <p className="text-[11px] text-muted-foreground">{describeAccess(member.role, member.can)}</p>
        </div>
        {!editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Mudar acesso
          </Button>
        )}
        <ConfirmIcon
          title="Remover acesso"
          onConfirm={async () => {
            const res = await window.focusHub.removeMember(boardId, member.userId)
            if (res.ok) onChanged()
            return res.error
          }}
        />
      </div>
      {editing && (
        <div className="mt-3 space-y-3">
          <PermissionPicker
            role={role}
            can={can}
            onChange={(r, c) => {
              setRole(r)
              setCan(c)
            }}
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRole(member.role)
                setCan(member.can)
                setEditing(false)
              }}
            >
              Cancelar
            </Button>
            <Button size="sm" variant="primary" onClick={() => void save()} disabled={busy}>
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function InviteRow({ invite, onChanged }: { invite: BoardInvite; onChanged: () => void }): JSX.Element {
  const expired = new Date(invite.expiresAt).getTime() < Date.now()
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface/40 px-3 py-2">
      <span className="font-mono text-sm tracking-wider">{invite.code}</span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
        {describeAccess(invite.role, invite.can)} ·{' '}
        {expired ? 'expirado' : `vale até ${formatDateTime(invite.expiresAt)}`}
      </span>
      {!expired && <CopyCode value={invite.code} compact />}
      <ConfirmIcon
        title="Cancelar código"
        onConfirm={async () => {
          const res = await window.focusHub.revokeInvite(invite.code)
          if (res.ok) onChanged()
          return res.error
        }}
      />
    </div>
  )
}

function MemberPanel({ board, onDone }: { board: Board; onDone: () => void }): JSX.Element {
  const [members, setMembers] = useState<BoardMember[]>([])
  useEffect(() => {
    void window.focusHub.listMembers(board.id).then(setMembers)
  }, [board.id])

  const can = board.shared?.can ?? FULL_PERMISSIONS
  const allOn = can.createCards && can.deleteCards && can.manageColumns
  const mine = describeAccess(allOn ? 'editor' : 'custom', can)

  return (
    <>
      <Section title="Seu acesso">
        <p className="text-sm">{mine}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Quem decide é o dono do quadro. Para mudar, fale com ele.
        </p>
      </Section>

      {members.length > 0 && (
        <Section title="Também têm acesso">
          <div className="space-y-1">
            {members.map((m) => (
              <p key={m.userId} className="truncate text-sm text-muted-foreground">
                {m.email}
              </p>
            ))}
          </div>
        </Section>
      )}

      <Section title="Sair do quadro">
        <p className="mb-2 text-xs text-muted-foreground">
          O quadro some deste PC. O dono e as outras pessoas continuam com ele.
        </p>
        <ConfirmButton
          label="Sair do quadro"
          confirmLabel="Sim, sair"
          onConfirm={async () => {
            const res = await window.focusHub.leaveBoard(board.id)
            if (res.ok) onDone()
            return res.error
          }}
        />
      </Section>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      {children}
    </div>
  )
}

function CopyCode({ value, compact }: { value: string; compact?: boolean }): JSX.Element {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      variant={compact ? 'ghost' : 'secondary'}
      className={cn(compact && 'h-7 px-2')}
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {!compact && (copied ? 'Copiado' : 'Copiar')}
    </Button>
  )
}

/**
 * A destructive action that asks once more in place. `onConfirm` returns an
 * error message to show, or nothing when it went through.
 */
function ConfirmButton({
  label,
  confirmLabel,
  onConfirm
}: {
  label: string
  confirmLabel: string
  onConfirm: () => Promise<string | undefined>
}): JSX.Element {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          variant={armed ? 'destructive' : 'secondary'}
          size="sm"
          disabled={busy}
          onClick={async () => {
            if (!armed) return setArmed(true)
            setBusy(true)
            setError(null)
            const err = await onConfirm()
            setBusy(false)
            if (err) setError(err)
            setArmed(false)
          }}
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {!busy && armed && <LogOut className="h-3.5 w-3.5" />}
          {armed ? confirmLabel : label}
        </Button>
        {armed && !busy && (
          <Button variant="ghost" size="sm" onClick={() => setArmed(false)}>
            Cancelar
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

/** The icon-sized version: first click arms it, second one goes. */
function ConfirmIcon({
  title,
  onConfirm
}: {
  title: string
  onConfirm: () => Promise<string | undefined>
}): JSX.Element {
  const [armed, setArmed] = useState(false)
  const pushToast = useToastStore((s) => s.push)
  return (
    <button
      title={armed ? 'Clique de novo para confirmar' : title}
      onClick={async () => {
        if (!armed) {
          setArmed(true)
          setTimeout(() => setArmed(false), 3000)
          return
        }
        const err = await onConfirm()
        if (err) pushToast({ title: 'Não deu certo', lines: [err], variant: 'warning' })
        setArmed(false)
      }}
      className={cn(
        'no-drag flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs transition-colors',
        armed
          ? 'bg-destructive/15 text-destructive'
          : 'text-muted-foreground hover:bg-surface-hover hover:text-destructive'
      )}
    >
      <UserMinus className="h-3.5 w-3.5" />
      {armed && 'Confirmar?'}
    </button>
  )
}
