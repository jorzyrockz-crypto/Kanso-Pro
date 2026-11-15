export type CardType = 'event' | 'task' | 'project' | 'note'
export type Filter = 'all' | CardType
export type Workspace = 'calendar' | 'tasks' | 'project' | 'journal'
export type Side = 'left' | 'right'
export type OccasionTheme = 'birthday' | 'celebration' | 'holiday' | 'remembrance'
export type OccasionChoice = 'auto' | 'none' | OccasionTheme

export interface ChecklistItem {
  id: string
  title: string
  done: boolean
  assignee?: string
  label?: string
}

interface BaseCard {
  id: string
  type: CardType
  title: string
  date: string
  side: Side
  context: string
  quiet?: boolean
  isCustom?: boolean
}

export interface EventCard extends BaseCard {
  type: 'event'
  allDay: boolean
  holiday: boolean
  occasion?: OccasionChoice
  time?: string
  endTime?: string
  owner: string
  organization: string
  location: string
}

export interface TaskCard extends BaseCard {
  type: 'task'
  reminder?: string
  subtasks: ChecklistItem[]
}

export interface ProjectCard extends BaseCard {
  type: 'project'
  dueDate: string
  team: string[]
  subtasks: ChecklistItem[]
  featured?: boolean
}

export interface NoteCard extends BaseCard {
  type: 'note'
  body: string
  tags: string[]
  pinned: boolean
  time?: string
}

export type JourneyCard = EventCard | TaskCard | ProjectCard | NoteCard

export interface JourneyState {
  version: 1
  cards: JourneyCard[]
  bezel: boolean
}

export type JourneyAction =
  | { type: 'add-card'; card: JourneyCard }
  | { type: 'update-note'; id: string; title?: string; body?: string }
  | { type: 'update-event-background'; id: string; occasion: OccasionChoice }
  | { type: 'toggle-item'; cardId: string; itemId: string }
  | { type: 'add-item'; cardId: string; item: ChecklistItem }
  | { type: 'toggle-bezel' }
  | { type: 'hydrate'; state: JourneyState }

export interface Destination {
  page: Workspace
  cardId?: string
}

export interface ComposerOptions {
  type?: CardType
  date?: string
}

export interface NewCardInput {
  type: CardType
  title: string
  date: string
  context: string
  time: string
  allDay: boolean
  dueDate: string
  details: string
  occasion?: OccasionChoice
}

export interface DayEntry {
  kind: 'day'
  date: string
  cards: JourneyCard[]
}

export interface GapEntry {
  kind: 'gap'
  start: string
  end: string
  cards: JourneyCard[]
}

export type TimelineEntry = DayEntry | GapEntry
