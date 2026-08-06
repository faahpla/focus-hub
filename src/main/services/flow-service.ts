import { exec } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { shell } from 'electron'
import type { FlowApplyResult, FlowConfig } from '../../shared/types'
import { normalizeHost } from '../../shared/flow'

const HOSTS_PATH = 'C:\\Windows\\System32\\drivers\\etc\\hosts'
const BLOCK_START = '# >>> FOCUS HUB BLOCK >>>'
const BLOCK_END = '# <<< FOCUS HUB BLOCK <<<'

const toCrlf = (s: string): string => s.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')

function run(cmd: string): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    exec(cmd, { windowsHide: true, timeout: 15000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: (stdout || stderr || '').trim() })
    })
  })
}

/**
 * FlowService turns the whole machine into the ideal work environment when a
 * session starts, and restores it when the session ends. Every step is
 * best-effort and never throws — failures are collected as warnings so the UI
 * can stay honest about what actually happened.
 */
export class FlowService {
  private active = false
  private elevated: boolean | null = null

  /** Whether the app is running elevated (needed to edit the hosts file). */
  async isElevated(): Promise<boolean> {
    if (this.elevated !== null) return this.elevated
    // The High Mandatory Level SID (locale-independent) only appears in the
    // token groups when the process is elevated.
    const res = await run('whoami /groups')
    this.elevated = res.ok && res.out.includes('S-1-16-12288')
    return this.elevated
  }

  private imageName(path: string): string {
    const exe = path.toLowerCase().endsWith('.exe') ? path : `${path}.exe`
    return exe.split(/[\\/]/).pop() as string
  }

  private async isRunning(image: string): Promise<boolean> {
    const res = await run(`tasklist /FI "IMAGENAME eq ${image}" /NH /FO CSV`)
    return res.out.toLowerCase().includes(image.toLowerCase())
  }

  async apply(config: FlowConfig): Promise<FlowApplyResult> {
    const result: FlowApplyResult = {
      launched: [],
      closed: [],
      opened: [],
      blockedSites: [],
      doNotDisturb: false,
      warnings: []
    }

    // 1. Close distracting apps — but only bother with ones actually running,
    //    and only warn when a kill genuinely failed (avoids false alarms).
    for (const app of config.closeApps) {
      const image = this.imageName(app.path)
      if (!(await this.isRunning(image))) continue
      await run(`taskkill /IM "${image}" /F /T`)
      if (await this.isRunning(image)) result.warnings.push(`Não consegui fechar ${app.name}`)
      else result.closed.push(app.name)
    }

    // 2. Launch required apps.
    for (const app of config.launchApps) {
      try {
        const err = await shell.openPath(app.path)
        if (err) {
          const res = await run(`start "" "${app.path}"`)
          if (res.ok) result.launched.push(app.name)
          else result.warnings.push(`Não consegui abrir ${app.name}`)
        } else {
          result.launched.push(app.name)
        }
      } catch {
        result.warnings.push(`Não consegui abrir ${app.name}`)
      }
    }

    // 3. Open project resources (files, folders, urls).
    for (const r of config.openResources) {
      try {
        if (r.kind === 'url') await shell.openExternal(r.path)
        else {
          const err = await shell.openPath(r.path)
          if (err) result.warnings.push(`Não consegui abrir ${r.label}`)
          else result.opened.push(r.label)
          continue
        }
        result.opened.push(r.label)
      } catch {
        result.warnings.push(`Não consegui abrir ${r.label}`)
      }
    }

    // 4. Open explicitly allowed sites.
    for (const site of config.allowSites) {
      try {
        await shell.openExternal(site.startsWith('http') ? site : `https://${site}`)
      } catch {
        /* ignore */
      }
    }

    // 5. Block distracting sites via the hosts file (needs admin).
    if (config.blockSites.length > 0) {
      if (!(await this.isElevated())) {
        result.warnings.push(
          'Bloqueio de sites desativado: execute o Focus HUB como administrador para ativá-lo.'
        )
      } else {
        const blocked = await this.writeHostsBlock(config.blockSites)
        if (blocked) {
          result.blockedSites = config.blockSites
          // The hosts file is only consulted on a fresh lookup. Tabs that are
          // already open keep their connection and their in-browser DNS cache,
          // so the block looks broken until the page is reloaded.
          result.warnings.push('Recarregue as abas já abertas para o bloqueio valer nelas.')
        } else {
          result.warnings.push(
            'Não consegui gravar o bloqueio no arquivo hosts (o antivírus pode estar protegendo ele).'
          )
        }
      }
    }

    // 6. Do Not Disturb — Windows Focus Assist has no public API, so we can't
    //    flip it programmatically. Flag it honestly rather than pretending.
    if (config.doNotDisturb) {
      result.doNotDisturb = false
      result.warnings.push('Não Perturbe: ative o Assistente de Foco (Win+A) manualmente.')
    }

    this.active = true
    return result
  }

  async release(): Promise<void> {
    if (!this.active) return
    await this.removeHostsBlock()
    this.active = false
  }

  /**
   * Strip any block left over from a session that never ended cleanly (a crash,
   * a force-quit, a Windows shutdown). Called once on startup — otherwise the
   * user stays locked out of a site with no session running and no way to tell
   * why, which is the worst possible failure for this feature.
   */
  async cleanupStale(): Promise<void> {
    await this.removeHostsBlock()
  }

  private async writeHostsBlock(sites: string[]): Promise<boolean> {
    try {
      let content = ''
      try {
        content = await fs.readFile(HOSTS_PATH, 'utf8')
      } catch {
        content = ''
      }
      const cleaned = this.stripBlock(content)
      const lines = [BLOCK_START]
      for (const raw of sites) {
        const host = normalizeHost(raw)
        if (!host) continue
        // 0.0.0.0 fails instantly; 127.0.0.1 waits on a local port that may
        // even answer if the user runs a dev server. Cover the subdomains a
        // distraction actually arrives through, not just the bare host.
        for (const variant of [host, `www.${host}`, `m.${host}`]) {
          lines.push(`0.0.0.0 ${variant}`)
        }
      }
      lines.push(BLOCK_END)
      // The hosts file is a Windows-owned text file: keep it CRLF.
      const next = toCrlf(`${cleaned.trimEnd()}\n${lines.join('\n')}\n`)
      await fs.writeFile(HOSTS_PATH, next, 'utf8')

      // Read it back. Writing can appear to succeed and then be reverted by
      // Defender's tamper protection, and reporting a block that isn't there
      // is worse than reporting a failure.
      const check = await fs.readFile(HOSTS_PATH, 'utf8')
      if (!check.includes(BLOCK_START)) return false

      await run('ipconfig /flushdns')
      return true
    } catch {
      return false
    }
  }

  private async removeHostsBlock(): Promise<void> {
    try {
      const content = await fs.readFile(HOSTS_PATH, 'utf8')
      const cleaned = this.stripBlock(content)
      if (cleaned !== content) {
        await fs.writeFile(HOSTS_PATH, toCrlf(`${cleaned.trimEnd()}\n`), 'utf8')
        await run('ipconfig /flushdns')
      }
    } catch {
      /* no permission — nothing we can safely do */
    }
  }

  private stripBlock(content: string): string {
    const start = content.indexOf(BLOCK_START)
    const end = content.indexOf(BLOCK_END)
    if (start === -1 || end === -1) return content
    return content.slice(0, start) + content.slice(end + BLOCK_END.length)
  }
}
