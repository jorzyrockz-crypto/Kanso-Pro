import type {
  CardType, EventCard, Filter, JourneyCard, NewCardInput, RolloverCandidate, TaskCard, TimelineEntry, TimelineItem, TimelineSourceEntry, Workspace,
} from '../types'
import { isOccasionChoice } from './occasions'

export const TYPE_CONFIG: Record<CardType, {
  workspace: Workspace
  label: string
  shortLabel: string
  link: string
}> = {
  event: { workspace: 'calendar', label: 'Event', shortLabel: 'Events', link: 'Open Calendar' },
  task: { workspace: 'tasks', label: 'Task list', shortLabel: 'Task lists', link: 'Open task lists' },
  project: { workspace: 'project', label: 'Project', shortLabel: 'Projects', link: 'Open project' },
  note: { workspace: 'journal', label: 'Journal Note', shortLabel: 'Journal Notes', link: 'Open Journal' },
}

export function parseDate(value: string): Date {
  return new Date(`${value}T12:00:00Z`)
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = parseDate(value)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(parseDate(value))
}

export function shortDate(value: string): string {
  return formatDate(value, { month: 'short', day: 'numeric' })
}

export function addDays(value: string, days: number): string {
  const date = parseDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function daysBetween(start: string, end: string): number {
  return Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / 86_400_000)
}

export function formatTime(time?: string, padded = false): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  const hour = hours % 12 || 12
  return `${padded ? String(hour).padStart(2, '0') : hour}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`
}

export function gapLabel(start: string, end: string): string {
  if (start === end) return shortDate(start)
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `${formatDate(start, { month: 'short' })} ${start.slice(8)} – ${end.slice(8)}`
  }
  return `${shortDate(start)} – ${shortDate(end)}`
}

export function progress(items: { done: boolean }[]) {
  const done = items.filter((item) => item.done).length
  return { done, total: items.length, percent: items.length ? Math.round(done / items.length * 100) : 0 }
}

export function projectStatus(percent: number): string {
  return percent === 100 ? 'Completed' : percent > 0 ? 'In progress' : 'Pending'
}

export function makeId(prefix = 'card'): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

/**
 * Scheduled, unfinished work from before today deserves one explicit choice rather
 * than silently following the user around the Timeline. Quiet and parked cards are
 * deliberately excluded: they are already a conscious deferment.
 */
export function rolloverCandidates(cards: JourneyCard[], today: string): RolloverCandidate[] {
  if (!isValidDate(today)) return []
  return cards.filter((card): card is RolloverCandidate => {
    if (card.backlog || card.quiet || (card.type !== 'task' && card.type !== 'project')) return false
    const scheduledFor = card.type === 'project' ? card.dueDate : card.date
    return scheduledFor < today && card.subtasks.some((item) => !item.done)
  }).sort((first, second) => {
    const firstDate = first.type === 'project' ? first.dueDate : first.date
    const secondDate = second.type === 'project' ? second.dueDate : second.date
    return firstDate.localeCompare(secondDate) || first.title.localeCompare(second.title)
  })
}

/** Quiet notes/actions live inside genuine gaps, never hiding scheduled cards. */
export function buildTimeline(cards: JourneyCard[], filter: Filter = 'all', sourceEntries: TimelineSourceEntry[] = []): TimelineEntry[] {
  const timelineCards = cards.filter((card) => !card.backlog)
  const visibleSources = (filter === 'all' || filter === 'event') ? sourceEntries : []
  const scheduledDates = [...new Set(timelineCards.filter((card) => !card.quiet).map((card) => card.date))].sort()
  const compact = new Set<string>()
  for (const card of timelineCards) {
    if (!card.quiet || scheduledDates.includes(card.date)) continue
    const previous = scheduledDates.filter((date) => date < card.date).at(-1)
    const next = scheduledDates.find((date) => date > card.date)
    if (previous && next && daysBetween(previous, next) > 3) compact.add(card.id)
  }

  const groups = new Map<string, TimelineItem[]>()
  timelineCards.filter((card) => !compact.has(card.id)).forEach((card) => {
    groups.set(card.date, [...(groups.get(card.date) ?? []), card])
  })
  visibleSources.forEach((entry) => {
    groups.set(entry.date, [...(groups.get(entry.date) ?? []), entry])
  })
  const dates = [...groups.keys()].sort()

  // Source references make their own dated rows. Keep compact personal cards visible as
  // one-day quiet buffers so a reference date never accidentally hides a personal note.
  if (visibleSources.length) {
    const quietByDate = new Map<string, JourneyCard[]>()
    timelineCards.filter((card) => compact.has(card.id) && (filter === 'all' || card.type === filter)).forEach((card) => {
      quietByDate.set(card.date, [...(quietByDate.get(card.date) ?? []), card])
    })
    const allDates = [...new Set([...dates, ...quietByDate.keys()])].sort()
    return allDates.flatMap((date) => {
      const visible = (groups.get(date) ?? []).filter((card) => 'calendarSource' in card || filter === 'all' || card.type === filter)
      const quietCards = quietByDate.get(date) ?? []
      return [
        ...(visible.length ? [{ kind: 'day' as const, date, cards: visible }] : []),
        ...(quietCards.length ? [{ kind: 'gap' as const, start: date, end: date, cards: quietCards }] : []),
      ]
    })
  }

  const entries: TimelineEntry[] = []
  dates.forEach((date, index) => {
    const previous = dates[index - 1]
    if (previous && daysBetween(previous, date) > 3) {
      const gapCards = timelineCards.filter((card) => compact.has(card.id) && card.date > previous && card.date < date)
        .filter((card) => filter === 'all' || card.type === filter)
        .sort((a, b) => a.date.localeCompare(b.date))
      if (filter === 'all' || filter === 'event' || gapCards.length) {
        entries.push({ kind: 'gap', start: addDays(previous, 1), end: addDays(date, -1), cards: gapCards })
      }
    }
    const visible = groups.get(date)!.filter((card): card is JourneyCard => !('calendarSource' in card) && (filter === 'all' || card.type === filter))
    if (visible.length) entries.push({ kind: 'day', date, cards: visible })
  })
  return entries
}

export function focusCard(cards: JourneyCard[], date: string): JourneyCard | undefined {
  return cards.find((card) => card.date === date && !card.quiet && !card.backlog)
    ?? cards.find((card) => card.type === 'project' && card.dueDate === date && !card.backlog)
    ?? [...cards].filter((card) => !card.quiet && !card.backlog).sort((a, b) => (
      Math.abs(daysBetween(a.date, date)) - Math.abs(daysBetween(b.date, date))
    ))[0]
}

export function createCard(input: NewCardInput, existing: JourneyCard[]): JourneyCard {
  const title = input.title.trim()
  if (!title || title.length > 160) throw new Error('Please enter a title between 1 and 160 characters.')
  if (!isValidDate(input.date)) throw new Error('Please choose a valid date.')
  if (input.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new Error('Please choose a valid time.')
  if (input.endTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.endTime)) throw new Error('Please choose a valid end time.')
  if (input.type === 'project' && (!isValidDate(input.dueDate) || input.dueDate < input.date)) {
    throw new Error('The project due date must be on or after its journey date.')
  }
  if (input.type === 'event' && input.occasion !== undefined && !isOccasionChoice(input.occasion)) {
    throw new Error('Please choose a valid occasion background.')
  }
  const base = {
    id: makeId(input.type),
    title,
    date: input.date,
    context: input.context.trim(),
    side: existing.filter((card) => card.isCustom).length % 2 ? 'right' as const : 'left' as const,
    isCustom: true,
  }
  const checklist = () => {
    const lines = input.details.split('\n').map((line) => line.trim()).filter(Boolean)
    return (lines.length ? lines : input.type === 'task' ? [title] : []).slice(0, 40)
      .map((line) => ({ id: makeId('item'), title: line.slice(0, 240), done: false }))
  }
  switch (input.type) {
    case 'event': return {
      ...base, type: 'event', allDay: input.allDay, holiday: false, occasion: input.occasion ?? 'auto',
      time: input.allDay ? undefined : input.time || '09:00', endTime: input.allDay ? undefined : input.endTime || undefined,
      owner: input.owner?.trim() || 'You', organization: input.organization?.trim() || 'Personal Calendar', location: input.location?.trim() || '',
    }
    case 'task': return { ...base, type: 'task', reminder: input.time || undefined, subtasks: checklist() }
    case 'project': return {
      ...base, type: 'project', dueDate: input.dueDate,
      team: ['You'], subtasks: checklist(), featured: true,
    }
    case 'note': return {
      ...base, type: 'note', body: input.details.trim(), tags: [], pinned: false,
    }
  }
}

/** Applies the shared card form without resetting a task's existing checklist progress. */
export function updateCardFromInput(card: EventCard | TaskCard, input: NewCardInput) {
  const created = createCard({ ...input, type: card.type }, [])
  if (card.type === 'event' && created.type === 'event') return {
    ...card,
    title: created.title,
    date: created.date,
    context: created.context,
    allDay: created.allDay,
    time: created.time,
    endTime: created.endTime,
    occasion: created.occasion,
    owner: created.owner,
    organization: created.organization,
    location: created.location,
  }
  if (card.type === 'task' && created.type === 'task') return {
    ...card,
    title: created.title,
    date: created.date,
    context: created.context,
    reminder: created.reminder,
  }
  return card
}

export function calendarDays(month: string): (string | null)[] {
  const first = `${month}-01`
  const date = parseDate(first)
  const offset = (date.getUTCDay() + 6) % 7
  const days: (string | null)[] = Array.from({ length: offset }, () => null)
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  for (let day = 1; day <= last; day++) days.push(`${month}-${String(day).padStart(2, '0')}`)
  while (days.length % 7) days.push(null)
  return days
}

export function shiftMonth(month: string, amount: number): string {
  const date = parseDate(`${month}-01`)
  date.setUTCMonth(date.getUTCMonth() + amount)
  return date.toISOString().slice(0, 7)
}
