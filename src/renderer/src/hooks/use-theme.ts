import { useEffect } from 'react'
import { useAppStore } from '@/stores/app-store'

/** Applies the current theme + accent color to the document root. */
export function useThemeEffect(): void {
  const theme = useAppStore((s) => s.settings.theme)
  const accent = useAppStore((s) => s.settings.accentColor)
  const font = useAppStore((s) => s.settings.fontSans)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (accent) {
      document.documentElement.style.setProperty('--primary', accent)
      document.documentElement.style.setProperty('--ring', accent)
    }
  }, [accent])

  useEffect(() => {
    if (font) document.documentElement.style.setProperty('--font-sans', `'${font}', system-ui, sans-serif`)
  }, [font])
}
