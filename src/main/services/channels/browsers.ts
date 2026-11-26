import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BrowserProfile } from '../../../shared/channels'

/**
 * The browsers on this PC and their profiles, read from each browser's own
 * "Local State". Each channel tends to be logged in its own profile, so a
 * login opens straight in the one the user picks.
 */

interface Browser {
  key: string
  label: string
  /** Under %LOCALAPPDATA% */
  data: string
  /** Relative to Program Files / Program Files (x86) / %LOCALAPPDATA% */
  exe: string
}

const BROWSERS: Browser[] = [
  {
    key: 'chrome',
    label: 'Chrome',
    data: 'Google/Chrome/User Data',
    exe: 'Google/Chrome/Application/chrome.exe'
  },
  {
    key: 'brave',
    label: 'Brave',
    data: 'BraveSoftware/Brave-Browser/User Data',
    exe: 'BraveSoftware/Brave-Browser/Application/brave.exe'
  },
  {
    key: 'edge',
    label: 'Edge',
    data: 'Microsoft/Edge/User Data',
    exe: 'Microsoft/Edge/Application/msedge.exe'
  }
]

function exeOf(browser: Browser): string | null {
  const roots = [
    process.env['ProgramFiles'],
    process.env['ProgramFiles(x86)'],
    process.env['LOCALAPPDATA']
  ]
  for (const root of roots) {
    if (!root) continue
    const path = join(root, browser.exe)
    if (existsSync(path)) return path
  }
  return null
}

export function listBrowserProfiles(): BrowserProfile[] {
  const local = process.env['LOCALAPPDATA']
  if (!local) return []
  const out: BrowserProfile[] = []
  for (const browser of BROWSERS) {
    if (!exeOf(browser)) continue
    try {
      const state = JSON.parse(readFileSync(join(local, browser.data, 'Local State'), 'utf8')) as {
        profile?: { info_cache?: Record<string, { name?: string; user_name?: string }> }
      }
      const profiles = Object.entries(state.profile?.info_cache ?? {})
      for (const [dir, info] of profiles) {
        out.push({
          id: `${browser.key}|${dir}`,
          browser: browser.label,
          name: info.name || dir,
          email: info.user_name || undefined
        })
      }
    } catch {
      /* browser installed but never opened */
    }
  }
  return out.sort(
    (a, b) => a.browser.localeCompare(b.browser) || a.name.localeCompare(b.name, 'pt-BR')
  )
}

export function openInProfile(profileId: string, url: string): boolean {
  const [key, dir] = profileId.split('|')
  const browser = BROWSERS.find((b) => b.key === key)
  const exe = browser && exeOf(browser)
  if (!exe || !dir || !/^https:\/\//.test(url)) return false
  spawn(exe, [`--profile-directory=${dir}`, url], { detached: true, stdio: 'ignore' }).unref()
  return true
}
