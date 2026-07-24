/** Quick validity check for the add-source form. */
export function isValidYoutubeUrl(raw: string): boolean {
  return parseYoutubeSource(raw) !== null
}

export type YoutubeSource =
  | { type: 'playlist'; list: string }
  | { type: 'video'; videoId: string }

/** Extracts a playlist id or video id from any YouTube URL. */
export function parseYoutubeSource(raw: string): YoutubeSource | null {
  const url = raw.trim()
  if (!url) return null

  const listMatch = url.match(/[?&]list=([^&\s]+)/)
  if (listMatch) return { type: 'playlist', list: listMatch[1] }

  const videoMatch =
    url.match(/[?&]v=([^&\s]+)/) ||
    url.match(/youtu\.be\/([^?&/\s]+)/) ||
    url.match(/\/embed\/([^?&/\s]+)/) ||
    url.match(/\/live\/([^?&/\s]+)/) ||
    url.match(/\/shorts\/([^?&/\s]+)/)
  if (videoMatch) return { type: 'video', videoId: videoMatch[1] }

  return null
}
