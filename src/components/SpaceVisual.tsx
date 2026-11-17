import { BookOpen, BriefcaseBusiness, CalendarDays, Landmark, Sparkles, UsersRound } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Space, SpaceIcon } from '../types'
import { defaultSpaceColor, defaultSpaceIcon, spaceColors } from '../lib/spaceAppearance'

const icons = {
  people: UsersRound,
  book: BookOpen,
  calendar: CalendarDays,
  briefcase: BriefcaseBusiness,
  sparkles: Sparkles,
  landmark: Landmark,
} satisfies Record<SpaceIcon, typeof UsersRound>

export function spaceAppearance(space: Pick<Space, 'kind' | 'color' | 'icon'>) {
  const color = spaceColors[space.color ?? defaultSpaceColor(space.kind)]
  return { color, icon: space.icon ?? defaultSpaceIcon(space.kind) }
}

export function SpaceGlyph({ space, size = '.75rem', className = '' }: { space: Pick<Space, 'kind' | 'color' | 'icon'>; size?: string | number; className?: string }) {
  const { icon } = spaceAppearance(space)
  const Icon = icons[icon]
  return <Icon className={className} size={size} aria-hidden="true" />
}

export function spaceAccentStyle(space: Pick<Space, 'kind' | 'color' | 'icon'>): CSSProperties {
  const { color } = spaceAppearance(space)
  return { '--space-accent': color.accent, '--space-soft': color.soft } as CSSProperties
}
