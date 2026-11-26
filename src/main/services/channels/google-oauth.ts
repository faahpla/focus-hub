import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * Google sign-in for an installed app: the browser opens Google's own page,
 * and the answer comes back to a one-off server on 127.0.0.1. PKCE guards the
 * code; the app never sees the password.
 */

export interface GoogleTokens {
  accessToken: string
  refreshToken: string
  /** ms since epoch */
  expiresAt: number
}

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const WAIT_MS = 5 * 60 * 1000

const b64url = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const PAGE = (title: string, text: string): string =>
  `<!doctype html><meta charset="utf-8"><title>Focus HUB</title>` +
  `<body style="font-family:system-ui;background:#0b0b0f;color:#eee;display:grid;place-items:center;height:100vh;margin:0">` +
  `<div style="text-align:center"><h2 style="margin:0 0 8px">${title}</h2>` +
  `<p style="color:#999;margin:0">${text}</p></div></body>`

/**
 * `onUrl` gets Google's page to open — the user picks which browser profile;
 * `signal` cancels the wait.
 */
export async function googleSignIn(
  clientId: string,
  clientSecret: string,
  scopes: string[],
  onUrl: (url: string) => void,
  signal: AbortSignal
): Promise<GoogleTokens> {
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const state = b64url(randomBytes(16))

  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const redirectUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  try {
    const code = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('O login não foi concluído a tempo. Tente de novo.')),
        WAIT_MS
      )
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new Error('Conexão cancelada.'))
      })
      server.on('request', (req, res) => {
        const url = new URL(req.url ?? '/', redirectUri)
        if (url.pathname !== '/') {
          res.writeHead(404).end()
          return
        }
        const got = url.searchParams.get('code')
        const error = url.searchParams.get('error')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        if (url.searchParams.get('state') !== state) {
          res.end(PAGE('Algo deu errado', 'Feche esta aba e tente de novo pelo Focus HUB.'))
          return
        }
        clearTimeout(timer)
        if (got) {
          res.end(PAGE('Conta conectada', 'Pode fechar esta aba e voltar ao Focus HUB.'))
          resolve(got)
        } else {
          res.end(PAGE('Conexão cancelada', 'Nada foi conectado. Pode fechar esta aba.'))
          reject(new Error(error === 'access_denied' ? 'Conexão cancelada.' : `Google: ${error}`))
        }
      })
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        access_type: 'offline',
        // Always ask which channel: one Google login can own several.
        prompt: 'consent select_account'
      })
      onUrl(`${AUTH_URL}?${params}`)
    })

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier
      })
    })
    const body = (await res.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      error_description?: string
    }
    if (!res.ok || !body.access_token || !body.refresh_token) {
      throw new Error(body.error_description ?? 'O Google não devolveu o acesso.')
    }
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000
    }
  } finally {
    server.close()
  }
}

/** Thrown when the user has to sign in again: access revoked or expired. */
export class SignInAgain extends Error {}

export async function refreshGoogleToken(
  clientId: string,
  clientSecret: string,
  tokens: GoogleTokens
): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token'
    })
  })
  const body = (await res.json()) as {
    access_token?: string
    expires_in?: number
    error?: string
  }
  if (body.error === 'invalid_grant') {
    throw new SignInAgain('A conexão com o Google expirou. Conecte a conta de novo.')
  }
  if (!res.ok || !body.access_token) throw new Error('Não deu para renovar o acesso ao Google.')
  return {
    ...tokens,
    accessToken: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000
  }
}
