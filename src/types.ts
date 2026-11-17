export type CardType = 'event' | 'task' | 'project' | 'note'
export type Filter = 'all' | CardType
export type Workspace = 'calendar' | 'tasks' | 'project' | 'journal'
export type Side = 'left' | 'right'
export type OccasionTheme = 'birthday' | 'celebration' | 'holiday' | 'remembrance' | 'school' | 'learning' | 'wellbeing' | 'community' | 'environment' | 'culture' | 'sports'
export type OccasionChoice = 'auto' | 'none' | OccasionTheme

export interface ChecklistItem {
  id: string
  title: string
  done: boolean
  assignee?: string
  /** Optional short planning tag, such as Q1, Procurement, or MOOE. */
  label?: string
  /** A milestone can carry a date independent from the overall project due date. */
  targetDate?: string
  /** One concise planning note, blocker, or status update. */
  remarks?: string
  /** Optional one-line note for a task-list item. */
  note?: string
  /** Optional task-item time label, stored as local 24-hour time. */
  time?: string
}

interface BaseCard {
  id: string
  type: CardType
  title: string
  date: string
  side: Side
  context: string
  quiet?: boolean
  /** Parked cards remain in their workspace but do not appear in the scheduled Timeline. */
  backlog?: boolean
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

export type JournalNoteKind = 'text' | 'voice' | 'image'

/** Attachment bytes live in browser IndexedDB; this metadata remains in the local Journey record. */
export interface JournalAttachment {
  id: string
  kind: 'audio' | 'image'
  name: string
  mimeType: string
  size: number
  durationSeconds?: number
  width?: number
  height?: number
  /** Image bytes are held in a dedicated signed-in Firestore document, never in card state. */
  storage?: 'firestore'
}

export interface NoteCard extends BaseCard {
  type: 'note'
  body: string
  tags: string[]
  pinned: boolean
  time?: string
  noteKind?: JournalNoteKind
  category?: string
  reminderAt?: string
  /** Legacy single attachment; retained so existing voice/image notes continue to render. */
  attachment?: JournalAttachment
  /** Additional studio attachments. Audio blobs stay in IndexedDB; images stay in private Firestore. */
  attachments?: JournalAttachment[]
  /** Sanitized rich-text markup for the studio editor; body remains the plain-text Timeline/search excerpt. */
  richText?: string
  updatedAt?: string
}

export type JourneyCard = EventCard | TaskCard | ProjectCard | NoteCard
export type RolloverCandidate = TaskCard | ProjectCard

/** A non-editable calendar reference rendered beside personal Timeline cards. */
export interface TimelineSourceEntry {
  id: string
  sourceId: string
  sourceLabel: string
  sourceProvenance: string
  title: string
  date: string
  endDate?: string
  detail?: string
  side: Side
  calendarSource: true
}

export type TimelineItem = JourneyCard | TimelineSourceEntry

export interface JourneyState {
  version: 1
  cards: JourneyCard[]
  bezel: boolean
}

export type JourneyAction =
  | { type: 'add-card'; card: JourneyCard }
  | { type: 'update-card'; card: JourneyCard }
  | { type: 'delete-card'; id: string }
  | { type: 'update-note'; id: string; title?: string; date?: string; context?: string; body?: string; tags?: string[]; category?: string; reminderAt?: string; noteKind?: JournalNoteKind; attachment?: JournalAttachment; attachments?: JournalAttachment[]; richText?: string; updatedAt?: string }
  | { type: 'update-event-background'; id: string; occasion: OccasionChoice }
  | { type: 'rollover-card'; id: string; date: string }
  | { type: 'backlog-card'; id: string }
  | { type: 'toggle-item'; cardId: string; itemId: string }
  | { type: 'add-item'; cardId: string; item: ChecklistItem }
  | { type: 'update-item'; cardId: string; item: ChecklistItem }
  | { type: 'delete-item'; cardId: string; itemId: string }
  | { type: 'move-item'; cardId: string; itemId: string; direction: 'up' | 'down' }
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
  endTime?: string
  allDay: boolean
  dueDate: string
  details: string
  owner?: string
  organization?: string
  location?: string
  occasion?: OccasionChoice
  /** Comma-separated collaborators collected by the project composer. */
  team?: string
}

export interface DayEntry {
  kind: 'day'
  date: string
  cards: TimelineItem[]
}

export interface GapEntry {
  kind: 'gap'
  start: string
  end: string
  cards: JourneyCard[]
}

export type TimelineEntry = DayEntry | GapEntry
