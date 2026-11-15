import type { EventCard, OccasionChoice, OccasionTheme } from '../types'

export const OCCASION_THEMES: Record<OccasionTheme, { label: string; description: string; start: string; end: string }> = {
  birthday: { label: 'Birthday', description: 'Cake, balloons, and a little joy.', start: '#6b284e', end: '#b14a72' },
  celebration: { label: 'Celebration', description: 'Bright stars for a moment worth celebrating.', start: '#34306e', end: '#6d53af' },
  holiday: { label: 'Holiday', description: 'Sunshine, soft waves, and room to unwind.', start: '#124957', end: '#2a7778' },
  remembrance: { label: 'Remembrance', description: 'A candle and quiet leaves for a thoughtful day.', start: '#1b3448', end: '#37645e' },
}

export const OCCASION_OPTIONS: { value: OccasionChoice; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: 'none', label: 'No illustration' },
  ...Object.entries(OCCASION_THEMES).map(([value, { label }]) => ({ value: value as OccasionTheme, label })),
]

export function isOccasionChoice(value: unknown): value is OccasionChoice {
  return typeof value === 'string' && OCCASION_OPTIONS.some((option) => option.value === value)
}

/** Suggestions only: the user's explicit choice, including none, always wins. */
export function suggestOccasion(title: string, holiday = false): OccasionTheme | 'none' {
  const normalized = title.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[’']/g, '')
  if (/\b(all\s+souls|all\s+saints|remembrance|memorial|undas|commemoration)\b/.test(normalized)) return 'remembrance'
  if (/\b(birthday|birthdays|bday|b-day|kaarawan)\b/.test(normalized)) return 'birthday'
  if (/\b(celebration|celebrate|anniversary|graduation|festival|fiesta|wedding|party|new\s+years?)\b/.test(normalized)) return 'celebration'
  if (holiday || /\b(holiday|holidays|vacation|christmas|xmas|easter|eid|diwali|lunar\s+new\s+year)\b/.test(normalized)) return 'holiday'
  return 'none'
}

export function resolveOccasion(event: Pick<EventCard, 'title'> & Partial<Pick<EventCard, 'holiday' | 'occasion'>>): OccasionTheme | 'none' {
  return event.occasion && event.occasion !== 'auto' ? event.occasion : suggestOccasion(event.title, event.holiday)
}

export function occasionLabel(theme: OccasionTheme | 'none'): string {
  return theme === 'none' ? 'No illustration' : OCCASION_THEMES[theme].label
}
