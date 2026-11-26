import { Facebook, Instagram, Music2, Youtube } from 'lucide-react'
import { PLATFORM_LABEL, type Platform } from '@shared/channels'
import { cn } from '@/lib/utils'

const ICON = { youtube: Youtube, tiktok: Music2, instagram: Instagram, facebook: Facebook }

/** A platform's icon in its own colour. */
export function PlatformMark({
  platform,
  className
}: {
  platform: Platform
  className?: string
}): JSX.Element {
  const Icon = ICON[platform]
  return (
    <Icon
      className={cn('h-4 w-4 shrink-0', className)}
      style={{ color: `hsl(var(--platform-${platform}))` }}
      aria-label={PLATFORM_LABEL[platform]}
    />
  )
}
