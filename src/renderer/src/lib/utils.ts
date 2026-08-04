import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * URL for showing a file from the user's disk in an <img>.
 *
 * The renderer runs on app://local in the installed app, and Chromium refuses
 * file:// from any other origin — the main process serves these paths over a
 * dedicated read-only scheme instead (see main/register-protocol.ts).
 */
export const mediaUrl = (absolutePath: string): string =>
  `localmedia://local/${encodeURI(absolutePath.replace(/\\/g, '/'))}`

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
