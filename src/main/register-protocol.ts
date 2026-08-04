import { protocol } from 'electron'
import { promises as fs } from 'node:fs'
import { join, normalize } from 'node:path'

/**
 * Serving the packaged renderer over a real, secure origin (app://local/…)
 * instead of file:// so browser features that reject opaque/file origins —
 * notably the YouTube IFrame Player API — work in the installed app.
 */
export const APP_SCHEME = 'app'
export const APP_ORIGIN = 'app://local'

/**
 * Scheme for showing a file the user picked from their own disk (a goal cover,
 * a receipt). The renderer runs on app://local, and Chromium blocks file://
 * from any other origin, so images need a scheme of their own.
 */
export const MEDIA_SCHEME = 'localmedia'

/** `localmedia://local/C:/Users/…/foto.png` for an absolute path. */
export function toMediaUrl(absolutePath: string): string {
  return `${MEDIA_SCHEME}://local/${encodeURI(absolutePath.replace(/\\/g, '/'))}`
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
}

function mimeFor(path: string): string {
  const dot = path.lastIndexOf('.')
  const ext = dot >= 0 ? path.slice(dot).toLowerCase() : ''
  return MIME[ext] ?? 'application/octet-stream'
}

/** Registered once, before app "ready", so the scheme behaves like https. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    },
    {
      scheme: MEDIA_SCHEME,
      // Deliberately no fetch/CORS support: these URLs are only ever meant to
      // be rendered as <img src>, never read as bytes by page script.
      privileges: { standard: true, secure: true, supportFetchAPI: false, corsEnabled: false }
    }
  ])
}

/** Serves images the user picked, by absolute path. Read-only, images only. */
export function serveLocalMedia(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const { pathname } = new URL(request.url)
    const full = normalize(decodeURIComponent(pathname).replace(/^\//, ''))
    const mime = mimeFor(full)
    if (!mime.startsWith('image/')) return new Response('Forbidden', { status: 403 })
    try {
      return new Response(await fs.readFile(full), { headers: { 'content-type': mime } })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

/** Wires the file server for app://local/*, called after app is ready. */
export function serveRenderer(rendererRoot: string): void {
  const root = normalize(rendererRoot)

  protocol.handle(APP_SCHEME, async (request) => {
    const { pathname } = new URL(request.url)
    let rel = decodeURIComponent(pathname)
    if (rel === '/' || rel === '') rel = '/index.html'

    const full = normalize(join(root, rel))
    // Block path traversal outside the renderer root.
    if (!full.startsWith(root)) {
      return new Response('Forbidden', { status: 403 })
    }

    try {
      const data = await fs.readFile(full)
      return new Response(data, { headers: { 'content-type': mimeFor(full) } })
    } catch {
      // SPA fallback — unknown paths return index.html.
      const index = await fs.readFile(join(root, 'index.html'))
      return new Response(index, { headers: { 'content-type': 'text/html' } })
    }
  })
}
