/**
 * Focus HUB — Modo Flow.
 *
 * The Flow config used to live only inside a project, which meant a session
 * started without a project silently did nothing at all — no apps closed, no
 * sites blocked, no warning. Flow is a feature of the app, not of a project,
 * so there is now a global config that always applies; a project's own Flow is
 * layered on top of it.
 */

import type { FlowConfig } from './types'

export function emptyFlow(): FlowConfig {
  return {
    launchApps: [],
    closeApps: [],
    openResources: [],
    blockSites: [],
    allowSites: [],
    doNotDisturb: false,
    ultraFocus: false
  }
}

/** Normalize a hostname the way the hosts file wants it: bare, lowercase. */
export function normalizeHost(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '')
}

/**
 * Combine the global Flow with a project's.
 *
 * Lists are unioned — the global config is the baseline that always applies
 * and a project only ever adds to it. Booleans come from the project, which is
 * the more specific intent; without a project the global value stands.
 */
export function mergeFlow(base: FlowConfig, project?: FlowConfig): FlowConfig {
  const byId = <T extends { id: string; path: string }>(a: T[], b: T[]): T[] => {
    const seen = new Set<string>()
    const out: T[] = []
    for (const item of [...a, ...b]) {
      const key = item.path.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
    return out
  }
  const hosts = (a: string[], b: string[]): string[] =>
    Array.from(new Set([...a, ...b].map(normalizeHost).filter(Boolean)))

  // Still normalize when there's no project — a host saved before this
  // function existed can be a full URL, and the chips and the hosts file both
  // need the bare name.
  if (!project) return { ...base, blockSites: hosts(base.blockSites, []) }

  return {
    launchApps: byId(base.launchApps, project.launchApps),
    closeApps: byId(base.closeApps, project.closeApps),
    openResources: byId(base.openResources, project.openResources),
    blockSites: hosts(base.blockSites, project.blockSites),
    allowSites: Array.from(new Set([...base.allowSites, ...project.allowSites])),
    doNotDisturb: project.doNotDisturb,
    ultraFocus: project.ultraFocus
  }
}

/** True when applying this config would actually do something to the machine. */
export function flowIsEmpty(flow: FlowConfig): boolean {
  return (
    flow.launchApps.length === 0 &&
    flow.closeApps.length === 0 &&
    flow.openResources.length === 0 &&
    flow.blockSites.length === 0 &&
    flow.allowSites.length === 0 &&
    !flow.doNotDisturb &&
    !flow.ultraFocus
  )
}
