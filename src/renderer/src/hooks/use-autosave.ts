import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Debounced autosave for a free-text field.
 *
 * Committing only on `blur` loses work in the ways that hurt most: closing a
 * dialog while the caret is still in the box (removing a focused element does
 * not reliably fire blur), or the machine shutting down mid-sentence. This
 * saves shortly after typing stops, and flushes on unmount, on window blur and
 * when the page is hidden.
 *
 * Returns the live text, a setter, and a manual flush for explicit saves.
 */
export function useAutosavedText(
  saved: string,
  commit: (next: string) => void,
  delay = 600
): [string, (next: string) => void, () => void] {
  const [text, setText] = useState(saved)

  // Keep the latest values reachable from listeners registered once.
  const textRef = useRef(text)
  const savedRef = useRef(saved)
  const commitRef = useRef(commit)
  textRef.current = text
  savedRef.current = saved
  commitRef.current = commit

  const flush = useCallback(() => {
    if (textRef.current !== savedRef.current) commitRef.current(textRef.current)
  }, [])

  // Debounced save while typing.
  useEffect(() => {
    if (text === saved) return
    const timer = setTimeout(() => commitRef.current(text), delay)
    return () => clearTimeout(timer)
  }, [text, saved, delay])

  // Safety nets: leaving the window, hiding it, or unmounting the field.
  useEffect(() => {
    const onLeave = (): void => flush()
    window.addEventListener('blur', onLeave)
    window.addEventListener('beforeunload', onLeave)
    document.addEventListener('visibilitychange', onLeave)
    return () => {
      window.removeEventListener('blur', onLeave)
      window.removeEventListener('beforeunload', onLeave)
      document.removeEventListener('visibilitychange', onLeave)
      flush()
    }
  }, [flush])

  return [text, setText, flush]
}
