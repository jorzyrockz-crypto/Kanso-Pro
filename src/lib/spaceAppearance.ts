import type { SpaceColor, SpaceIcon } from '../types'

export const spaceColors: Record<SpaceColor, { label: string; accent: string; soft: string }> = {
  ocean: { label: 'Ocean', accent: '#247ca5', soft: '#e3f4fb' },
  violet: { label: 'Violet', accent: '#6958b3', soft: '#efedff' },
  rose: { label: 'Rose', accent: '#b65378', soft: '#fcecf1' },
  amber: { label: 'Amber', accent: '#a66b0e', soft: '#fff2d5' },
  forest: { label: 'Forest', accent: '#23775e', soft: '#e5f7ef' },
  slate: { label: 'Slate', accent: '#486779', soft: '#e9f0f4' },
}

export const spaceIcons: { id: SpaceIcon; label: string }[] = [
  { id: 'people', label: 'People' },
  { id: 'book', label: 'Book' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'briefcase', label: 'Briefcase' },
  { id: 'sparkles', label: 'Sparkles' },
  { id: 'landmark', label: 'Landmark' },
]

export function isSpaceColor(value: unknown): value is SpaceColor {
  return typeof value === 'string' && Object.hasOwn(spaceColors, value)
}

export function isSpaceIcon(value: unknown): value is SpaceIcon {
  return typeof value === 'string' && spaceIcons.some((icon) => icon.id === value)
}

export function defaultSpaceColor(kind: 'personal' | 'shared'): SpaceColor {
  return kind === 'shared' ? 'violet' : 'ocean'
}

export function defaultSpaceIcon(kind: 'personal' | 'shared'): SpaceIcon {
  return kind === 'shared' ? 'people' : 'book'
}
