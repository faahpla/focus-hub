import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Sign in or create the account that reaches shared boards.
 *
 * E-mail and password, no confirmation step: Supabase's built-in mailer only
 * delivers to the project's own team, so a confirmation link or a login code
 * would never reach anyone else. Access to a board is proven by the invite
 * code instead.
 */
export function AccountForm({ onDone }: { onDone?: () => void }): JSX.Element {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (): Promise<void> => {
    if (busy || !email.trim() || !password) return
    setBusy(true)
    setError(null)
    const res =
      mode === 'signin'
        ? await window.focusHub.signIn(email, password)
        : await window.focusHub.signUp(email, password)
    setBusy(false)
    if (res.ok) onDone?.()
    else setError(res.error ?? 'Não deu certo. Tente de novo.')
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-surface/60 p-1">
        {(['signin', 'signup'] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m)
              setError(null)
            }}
            className={cn(
              'no-drag flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              mode === m
                ? 'bg-surface-elevated text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {m === 'signin' ? 'Entrar' : 'Criar conta'}
          </button>
        ))}
      </div>

      <Input
        autoFocus
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu@email.com"
        autoComplete="email"
      />
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void submit()}
        placeholder={mode === 'signup' ? 'Crie uma senha (6+ caracteres)' : 'Senha'}
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button
        variant="primary"
        className="w-full"
        onClick={() => void submit()}
        disabled={busy || !email.trim() || !password}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {mode === 'signin' ? 'Entrar' : 'Criar conta e entrar'}
      </Button>

      {mode === 'signup' && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Guarde a senha: ainda não existe "esqueci minha senha". Se perder, crie outra conta e
          peça um novo código para quem compartilhou o quadro.
        </p>
      )}
    </div>
  )
}
