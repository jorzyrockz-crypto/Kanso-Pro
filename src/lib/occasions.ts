import type { EventCard, OccasionChoice, OccasionTheme } from '../types'

export const OCCASION_THEMES: Record<OccasionTheme, { label: string; description: string; start: string; end: string }> = {
  birthday: { label: 'Birthday', description: 'Cake, balloons, and a little joy.', start: '#6b284e', end: '#b14a72' },
  celebration: { label: 'Celebration', description: 'Bright stars for a moment worth celebrating.', start: '#34306e', end: '#6d53af' },
  holiday: { label: 'Holiday', description: 'Sunshine, soft waves, and room to unwind.', start: '#124957', end: '#2a7778' },
  remembrance: { label: 'Remembrance', description: 'A candle and quiet leaves for a thoughtful day.', start: '#1b3448', end: '#37645e' },
  school: { label: 'School activity', description: 'Books, a school bell, and a clear day of learning ahead.', start: '#17395d', end: '#367aa5' },
  learning: { label: 'Learning & literacy', description: 'Open books and bright ideas for reading, learning, and discovery.', start: '#30326b', end: '#5a76ad' },
  wellbeing: { label: 'Health & wellbeing', description: 'Gentle care, balance, and wellbeing for the school community.', start: '#17635d', end: '#4da78a' },
  community: { label: 'Community & service', description: 'Hands together for service, connection, and shared purpose.', start: '#7d3f4a', end: '#bd7165' },
  environment: { label: 'Environment & resilience', description: 'Growing things, clean water, and care for a resilient future.', start: '#1f644c', end: '#67a762' },
  culture: { label: 'Culture & heritage', description: 'Philippine-inspired color, music, language, and heritage.', start: '#69364d', end: '#ab5d67' },
  sports: { label: 'Sports & youth', description: 'Movement, teamwork, and youthful energy in every stride.', start: '#244c82', end: '#4e8fbd' },
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
  if (holiday || /\b(holiday|holidays|vacation|christmas|xmas|easter|eid|diwali|lunar\s+new\s+year)\b/.test(normalized)) return 'holiday'
  if (/\b(graduation|wedding|party)\b/.test(normalized)) return 'celebration'
  if (/\b(reading|literacy|learning|book\b|library|science|math|training|workshop|education|pagbasa|aral)\b/.test(normalized)) return 'learning'
  if (/\b(health|wellness|mental\s+health|nutrition|immunization|dental|medical|wellbeing|dengue|cancer|autism)\b/.test(normalized)) return 'wellbeing'
  if (/\b(environment|climate|coastal|clean(?:-up)?|tree\b|waste|conservation|disaster|resilience)\b/.test(normalized)) return 'environment'
  if (/\b(community|brigada|volunteer|family|parents?|pta\b|outreach|inclusion|accessibility|service|human\s+rights)\b/.test(normalized)) return 'community'
  if (/\b(wika|language|arts?|music|heritage|indigenous|history|filipino)\b/.test(normalized)) return 'culture'
  if (/\b(sports?|palaro(?:ng)?|scouting|athletics?|games?|youth)\b/.test(normalized)) return 'sports'
  if (/\b(school|classroom|faculty|curriculum|deped|inset|term\b|assessment|exam(?:ination)?|orientation|teachers?|guro)\b/.test(normalized)) return 'school'
  if (/\b(celebration|celebrate|anniversary|graduation|festival|fiesta|wedding|party|new\s+years?)\b/.test(normalized)) return 'celebration'
  return 'none'
}

export function resolveOccasion(event: Pick<EventCard, 'title'> & Partial<Pick<EventCard, 'holiday' | 'occasion'>>): OccasionTheme | 'none' {
  return event.occasion && event.occasion !== 'auto' ? event.occasion : suggestOccasion(event.title, event.holiday)
}

export function occasionLabel(theme: OccasionTheme | 'none'): string {
  return theme === 'none' ? 'No illustration' : OCCASION_THEMES[theme].label
}
