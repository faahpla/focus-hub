import { Plus, RefreshCw } from 'lucide-react'
import { PLATFORMS, PLATFORM_LABEL, type ChannelAccount, type Platform } from '@shared/channels'
import type { Board } from '@shared/types'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DynamicIcon } from '@/components/dynamic-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/stores/app-store'
import { useChannelsStore } from '@/stores/channels-store'
import { useToastStore } from '@/stores/toast-store'
import { AccountTile } from './account-tile'
import { PlatformMark } from './platform-mark'
import { SignInDialog } from './sign-in-dialog'
import { VideosTable } from './videos-table'
import { fmtCompact, fmtMoney } from './channel-utils'

/**
 * Every channel's numbers in one place. A channel is a board: its YouTube,
 * TikTok, Instagram and Facebook accounts sit together under it.
 */
export function ChannelsPage(): JSX.Element {
  const state = useChannelsStore((s) => s.state)
  const boards = useAppStore((s) => s.boards).filter((b) => !b.archived)
  const connect = async (platform: Platform): Promise<void> => {
    const res = await window.focusHub.connectChannel(platform)
    const push = useToastStore.getState().push
    if (res.ok) {
      push({
        title: `${PLATFORM_LABEL[platform]} conectado`,
        lines: ['Escolha no menu da conta (⋯) de qual canal ela é.'],
        variant: 'success'
      })
    } else if (res.error) {
      push({ title: 'Não deu para conectar', lines: [res.error], variant: 'warning' })
    }
  }

  if (!state) return <div />

  const groups = groupByBoard(state.accounts, boards)
  const busy = state.syncing.length > 0

  const connectMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="primary">
          <Plus className="h-4 w-4" />
          Conectar conta
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {PLATFORMS.map((p) => (
          <DropdownMenuItem key={p} disabled={!state.available[p]} onSelect={() => void connect(p)}>
            <PlatformMark platform={p} />
            {PLATFORM_LABEL[p]}
            {!state.available[p] && (
              <span className="ml-auto text-[10px] text-muted-foreground">em breve</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div>
      <PageHeader
        title="Canais"
        subtitle="Os números de todas as redes, num lugar só."
        action={
          <div className="flex gap-2">
            {state.accounts.length > 0 && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void window.focusHub.refreshChannels()}
              >
                <RefreshCw className={busy ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                Atualizar
              </Button>
            )}
            {connectMenu}
          </div>
        }
      />

      <div className="space-y-8 px-8 pb-24">
        {state.accounts.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-base font-semibold">Conecte seus canais</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Views, seguidores, retenção e receita de cada rede aparecem aqui, e cada vídeo
              publicado se liga ao card dele. Só leitura: o Focus HUB não publica nem muda nada nas
              suas contas.
            </p>
            {!state.available.youtube && (
              <p className="mx-auto mt-3 max-w-md text-xs text-warning">
                O login do Google ainda não está configurado nesta versão.
              </p>
            )}
          </Card>
        )}

        {groups.map(({ board, accounts }) => (
          <section key={board?.id ?? 'none'}>
            <ChannelHeader board={board} accounts={accounts} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {accounts.map((account) => (
                <AccountTile
                  key={account.id}
                  account={account}
                  boards={boards}
                  syncing={state.syncing.includes(account.id)}
                />
              ))}
            </div>
          </section>
        ))}

        {state.videos.length > 0 && <VideosTable state={state} />}
        {state.signIn && <SignInDialog signIn={state.signIn} />}

        {state.accounts.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Todos os números vêm direto das plataformas, sem estimativas nossas. Receita em reais,
            como a plataforma calcula. "Short" é deduzido pela duração (até 3 min): a API não diz.
            Os números de análise chegam com 1–2 dias de atraso.
          </p>
        )}
      </div>
    </div>
  )
}

function ChannelHeader({
  board,
  accounts
}: {
  board?: Board
  accounts: ChannelAccount[]
}): JSX.Element {
  const followers = sum(accounts.map((a) => a.followers))
  const views = sum(accounts.map((a) => a.period?.views))
  const revenues = accounts.map((a) => a.period?.revenue).filter((r) => typeof r === 'number')
  return (
    <div className="mb-3 flex flex-wrap items-end gap-x-6 gap-y-1">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        {board ? (
          <>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: `hsl(${board.color} / 0.18)`, color: `hsl(${board.color})` }}
            >
              <DynamicIcon name={board.icon} className="h-4 w-4" />
            </span>
            {board.name}
          </>
        ) : (
          <span className="text-muted-foreground">Sem canal definido</span>
        )}
      </h2>
      {accounts.length > 1 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground tabular">{fmtCompact(followers)}</span>{' '}
          seguidores ·{' '}
          <span className="font-medium text-foreground tabular">{fmtCompact(views)}</span> views em
          28 dias
          {revenues.length > 0 && (
            <>
              {' '}
              ·{' '}
              <span className="font-medium text-foreground tabular">{fmtMoney(sum(revenues))}</span>
            </>
          )}
        </p>
      )}
    </div>
  )
}

const sum = (values: (number | null | undefined)[]): number | undefined => {
  const known = values.filter((v): v is number => typeof v === 'number')
  return known.length ? known.reduce((a, b) => a + b, 0) : undefined
}

/** Accounts under their board, in the boards' own order; unassigned last. */
function groupByBoard(
  accounts: ChannelAccount[],
  boards: Board[]
): { board?: Board; accounts: ChannelAccount[] }[] {
  const order = [...boards].sort((a, b) => a.order - b.order)
  const groups = order
    .map((board) => ({ board, accounts: accounts.filter((a) => a.boardId === board.id) }))
    .filter((g) => g.accounts.length > 0)
  const loose = accounts.filter((a) => !a.boardId || !boards.some((b) => b.id === a.boardId))
  const byPlatform = (a: ChannelAccount, b: ChannelAccount): number =>
    PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform)
  return [
    ...groups.map((g) => ({ ...g, accounts: g.accounts.sort(byPlatform) })),
    ...(loose.length ? [{ accounts: loose.sort(byPlatform) }] : [])
  ]
}
