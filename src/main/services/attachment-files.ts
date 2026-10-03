import { extname } from 'node:path'

/**
 * Rules for files attached to cards — pure, so they can be checked alone.
 */

/** Private bucket created by supabase/schema.sql. */
export const ATTACHMENT_BUCKET = 'attachments'

/**
 * Cloud files live two days: long enough for the other person to grab them,
 * short enough that the free plan's 1 GB never fills.
 */
export const ATTACHMENT_TTL_MS = 2 * 24 * 60 * 60 * 1000

/** Matches the bucket's limit. A card's MP3 + thumbnail + notes stay far below it. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

const TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.txt': 'text/plain; charset=utf-8',
  '.srt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf'
}

export function contentTypeOf(fileName: string): string {
  return TYPES[extname(fileName).toLowerCase()] ?? 'application/octet-stream'
}

/**
 * Where a file goes in the bucket: <board id>/<attachment id>__<ascii name>.
 * The board's id comes first because the bucket's rules read it from there.
 * Storage keys reject much of Unicode, so accents and emoji are folded away
 * here — the real name is kept in the card and used again when downloading.
 */
export function storageKeyOf(boardId: string, attachmentId: string, fileName: string): string {
  const ascii = fileName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    // A name made only of emoji folds down to underscores — say so instead.
    .replace(/^_+|_+$/g, '')
    .slice(-80)
  return `${boardId}/${attachmentId}__${ascii || 'arquivo'}`
}

/**
 * A card title made safe as a Windows folder name: the characters Windows
 * refuses become spaces, and trailing dots and spaces go (Explorer cannot
 * open a folder that ends in one). Emoji are fine and stay.
 */
export function folderNameOf(title: string): string {
  const cleaned = title
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 80)
    .trim()
  return cleaned || 'Card'
}

/**
 * A downloaded file's name, safe on Windows whatever system it came from.
 * Shortened from the middle of the name, never the end: losing ".mp3" would
 * leave a file nothing knows how to open.
 */
export function fileNameOf(name: string): string {
  const ext = extname(name)
  const base = name.slice(0, name.length - ext.length)
  const clean = (s: string): string =>
    s.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_').trim().replace(/[. ]+$/, '')
  return `${clean(base).slice(0, 120) || 'arquivo'}${clean(ext)}`
}

/** "2,4 MB", "830 KB" — how a file's size reads in a notice. */
export function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
