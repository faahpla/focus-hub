import { useEffect, useState } from 'react'
import { Check, Copy, Globe, Loader2 } from 'lucide-react'
import { PLATFORM_LABEL, type BrowserProfile, type PendingSignIn } from '@shared/channels'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * A login waiting to be opened. Each channel tends to be logged in its own
 * browser profile, so the user picks where it opens.
 */
export function SignInDialog({ signIn }: { signIn: PendingSignIn }): JSX.Element {
  const [profiles, setProfiles] = useState<BrowserProfile[]>([])
  const [opened, setOpened] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void window.focusHub.browserProfiles().then(setProfiles)
  }, [])

  const open = (profileId: string | null): void => {
    setOpened(profileId ?? 'default')
    void window.focusHub.openSignIn(profileId)
  }

  const copy = (): void => {
    void navigator.clipboard.writeText(signIn.url)
    setCopied(true)
  }

  const browsers = [...new Set(profiles.map((p) => p.browser))]

  return (
    <Dialog open onOpenChange={(o) => !o && void window.focusHub.cancelSignIn()}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>Conectar {PLATFORM_LABEL[signIn.platform]}</DialogTitle>
          <DialogDescription>
            Abra no perfil do navegador em que o canal está logado.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1 scrollbar-thin">
          {browsers.map((browser) => (
            <div key={browser}>
              <p className="mb-1 px-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                {browser}
              </p>
              <div className="space-y-1">
                {profiles
                  .filter((p) => p.browser === browser)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => open(p.id)}
                      className={cn(
                        'no-drag flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover',
                        opened === p.id && 'bg-primary/15'
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.name}</span>
                        {p.email && (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {p.email}
                          </span>
                        )}
                      </span>
                      {opened === p.id && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
          <Button variant="secondary" onClick={() => open(null)}>
            <Globe className="h-4 w-4" /> Navegador padrão
          </Button>
          <Button variant="secondary" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Link copiado' : 'Copiar link'}
          </Button>
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => void window.focusHub.cancelSignIn()}
          >
            Cancelar
          </Button>
        </div>
        {opened && (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Esperando você terminar no navegador. Abriu no perfil errado? É só escolher outro.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
