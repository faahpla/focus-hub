import { cn } from '@/lib/utils'
import type { Person } from './people'

/** A round avatar in the person's colour, with their initials. */
export function PersonAvatar({
  person,
  size = 'sm'
}: {
  person: Person
  size?: 'sm' | 'md'
}): JSX.Element {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        size === 'sm' ? 'h-4 w-4 text-[8px]' : 'h-5 w-5 text-[9px]'
      )}
      style={{ backgroundColor: `hsl(${person.color})` }}
      title={person.email}
    >
      {person.initials}
    </span>
  )
}

/** Avatar plus name — the chip a card wears to say whose it is. */
export function PersonChip({ person }: { person: Person }): JSX.Element {
  return (
    <span
      className="flex items-center gap-1 rounded-md py-0.5 pl-0.5 pr-1.5 text-[10px] font-medium"
      style={{
        backgroundColor: `hsl(${person.color} / 0.15)`,
        color: `hsl(${person.color})`
      }}
    >
      <PersonAvatar person={person} />
      {person.label}
    </span>
  )
}
