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
    }
  ])
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
