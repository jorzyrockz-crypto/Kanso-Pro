import { useEffect, useReducer, useState } from 'react'
import { createInitialState, LEGACY_STORAGE_KEY, STORAGE_KEY } from '../data'
import type { JourneyAction, JourneyCard, JourneyState, QuickReaction, ReactionEmoji, EventAcknowledgement } from '../types'
import { isValidDate } from './journey'
import { isOccasionChoice } from './occasions'

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isReactions(value: unknown): value is QuickReaction[] {
  return Array.isArray(value) && value.length <= 100 && value.every((reaction: unknown) => {
    if (!reaction || typeof reaction !== 'object') return false
    const entry = reaction as Record<string, unknown>
    return (['👍', '✅', '👀'] as ReactionEmoji[]).includes(String(entry.emoji) as ReactionEmoji)
      && isString(entry.member) && entry.member.length <= 120
  })
}

function isAcknowledgements(value: unknown): value is EventAcknowledgement[] {
  return Array.isArray(value) && value.length <= 100 && value.every((acknowledgement: unknown) => {
    if (!acknowledgement || typeof acknowledgement !== 'object') return false
    const entry = acknowledgement as Record<string, unknown>
    return isString(entry.member) && entry.member.length <= 120 && ['going', 'noted'].includes(String(entry.response))
  })
}

function isChecklist(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 1000 && value.every((item: unknown) => {
    if (!item || typeof item !== 'object') return false
    const entry = item as Record<string, unknown>
    const comments = entry.comments
    const validComments = comments === undefined || (Array.isArray(comments) && comments.length <= 100 && comments.every((comment: unknown) => {
      if (!comment || typeof comment !== 'object') return false
      const value = comment as Record<string, unknown>
      return isString(value.id) && isString(value.body) && isString(value.author) && isString(value.createdAt)
    }))
    return isString(entry.id) && isString(entry.title) && typeof entry.done === 'boolean'
      && (entry.assignee === undefined || isString(entry.assignee))
      && (entry.completedBy === undefined || isString(entry.completedBy))
      && (entry.completedAt === undefined || isString(entry.completedAt))
      && validComments
      && (entry.label === undefined || isString(entry.label))
      && (entry.targetDate === undefined || (isString(entry.targetDate) && isValidDate(entry.targetDate)))
      && (entry.remarks === undefined || isString(entry.remarks))
      && (entry.note === undefined || isString(entry.note))
      && (entry.time === undefined || (isString(entry.time) && /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time)))
      && (entry.reactions === undefined || isReactions(entry.reactions))
  }) && new Set(value.map((item) => item.id)).size === value.length
}

function isJournalAttachment(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const attachment = value as Record<string, unknown>
  return isString(attachment.id)
    && ['audio', 'image'].includes(String(attachment.kind))
    && isString(attachment.name)
    && isString(attachment.mimeType)
    && typeof attachment.size === 'number'
    && (attachment.durationSeconds === undefined || typeof attachment.durationSeconds === 'number')
    && (attachment.width === undefined || typeof attachment.width === 'number')
    && (attachment.height === undefined || typeof attachment.height === 'number')
    && (attachment.storage === undefined || attachment.storage === 'firestore')
}

function isCard(value: unknown): value is JourneyCard {
  if (!value || typeof value !== 'object') return false
  const card = value as Record<string, unknown>
  if (!isString(card.id) || !isString(card.title) || !isValidDate(card.date)
    || !['left', 'right'].includes(String(card.side)) || !isString(card.context)
    || (card.quiet !== undefined && typeof card.quiet !== 'boolean')
    || (card.backlog !== undefined && typeof card.backlog !== 'boolean')
    || (card.isCustom !== undefined && typeof card.isCustom !== 'boolean')
    || (card.authoredBy !== undefined && !isString(card.authoredBy))
    || (card.lastEditedBy !== undefined && !isString(card.lastEditedBy))
    || (card.reactions !== undefined && !isReactions(card.reactions))) return false
  if (card.type === 'event') return typeof card.allDay === 'boolean' && typeof card.holiday === 'boolean'
    && isString(card.owner) && isString(card.organization) && isString(card.location)
    && (card.time === undefined || isString(card.time)) && (card.endTime === undefined || isString(card.endTime))
    && (card.occasion === undefined || isOccasionChoice(card.occasion))
    && (card.acknowledgements === undefined || isAcknowledgements(card.acknowledgements))
  if (card.type === 'task') return isChecklist(card.subtasks) && (card.reminder === undefined || isString(card.reminder))
  if (card.type === 'project') return isValidDate(card.dueDate) && isChecklist(card.subtasks)
    && Array.isArray(card.team) && card.team.every(isString)
    && (card.featured === undefined || typeof card.featured === 'boolean')
  if (card.type === 'note') return isString(card.body) && typeof card.pinned === 'boolean'
    && Array.isArray(card.tags) && card.tags.every(isString) && (card.time === undefined || isString(card.time))
    && (card.noteKind === undefined || ['text', 'voice', 'image'].includes(String(card.noteKind)))
    && (card.category === undefined || isString(card.category))
    && (card.reminderAt === undefined || isString(card.reminderAt))
    && (card.updatedAt === undefined || isString(card.updatedAt))
    && (card.richText === undefined || isString(card.richText))
    && (card.attachment === undefined || isJournalAttachment(card.attachment))
    && (card.attachments === undefined || (Array.isArray(card.attachments) && card.attachments.length <= 24
      && card.attachments.every(isJournalAttachment) && new Set(card.attachments.map((attachment) => attachment.id)).size === card.attachments.length))
  return false
}

export function parseSavedState(raw: string | null): JourneyState | null {
  if (!raw) return null
  try {
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    const state = data as Record<string, unknown>
    if (state.version !== 1 || typeof state.bezel !== 'boolean'
      || !Array.isArray(state.cards) || state.cards.length > 10000 || !state.cards.every(isCard)
      || new Set(state.cards.map((card) => card.id)).size !== state.cards.length) return null
    return state as unknown as JourneyState
  } catch {
    return null
  }
}

export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  switch (action.type) {
    case 'hydrate': return action.state
    case 'toggle-bezel': return { ...state, bezel: !state.bezel }
    case 'add-card': return state.cards.some((card) => card.id === action.card.id) ? state : {
      ...state, cards: [...state.cards, action.card],
    }
    // A replacement must keep its identity and kind. This prevents a stale editor from
    // accidentally overwriting a different card after a cross-tab update.
    case 'update-card': {
      const exists = state.cards.some((card) => card.id === action.card.id && card.type === action.card.type)
      return !exists || !isCard(action.card) ? state : {
        ...state,
        cards: state.cards.map((card) => card.id === action.card.id ? action.card : card),
      }
    }
    case 'delete-card': return state.cards.some((card) => card.id === action.id) ? {
      ...state, cards: state.cards.filter((card) => card.id !== action.id),
    } : state
    case 'update-note': return {
      ...state,
      cards: state.cards.map((card) => card.type === 'note' && card.id === action.id ? {
        ...card,
        ...(action.title !== undefined ? { title: action.title } : {}),
        ...(action.date !== undefined && isValidDate(action.date) ? { date: action.date } : {}),
        ...(action.context !== undefined ? { context: action.context } : {}),
        ...(action.body !== undefined ? { body: action.body } : {}),
        ...(action.tags !== undefined ? { tags: action.tags } : {}),
        ...(action.category !== undefined ? { category: action.category } : {}),
        ...(action.reminderAt !== undefined ? { reminderAt: action.reminderAt } : {}),
        ...(action.noteKind !== undefined ? { noteKind: action.noteKind } : {}),
        ...(action.attachment !== undefined ? { attachment: action.attachment } : {}),
        ...(action.attachments !== undefined ? { attachments: action.attachments } : {}),
        ...(action.richText !== undefined ? { richText: action.richText } : {}),
        ...(action.updatedAt !== undefined ? { updatedAt: action.updatedAt } : {}),
        ...(action.lastEditedBy !== undefined ? { lastEditedBy: action.lastEditedBy } : {}),
      } : card),
    }
    case 'update-event-background': return !isOccasionChoice(action.occasion) ? state : {
      ...state,
      cards: state.cards.map((card) => card.type === 'event' && card.id === action.id ? { ...card, occasion: action.occasion } : card),
    }
    case 'rollover-card': return !isValidDate(action.date) ? state : {
      ...state,
      cards: state.cards.map((card) => (card.type === 'task' || card.type === 'project') && card.id === action.id ? {
        ...card,
        date: action.date,
        quiet: false,
        backlog: false,
        ...(card.type === 'project' && card.dueDate < action.date ? { dueDate: action.date } : {}),
      } : card),
    }
    case 'backlog-card': return {
      ...state,
      cards: state.cards.map((card) => (card.type === 'task' || card.type === 'project') && card.id === action.id ? { ...card, backlog: true } : card),
    }
    case 'toggle-item': return {
      ...state,
      cards: state.cards.map((card) => (card.type === 'task' || card.type === 'project') && card.id === action.cardId ? {
        ...card, subtasks: card.subtasks.map((item) => {
          if (item.id !== action.itemId) return item
          const done = !item.done
          return { ...item, done, ...(done ? { completedBy: action.actor ?? item.assignee ?? 'You', completedAt: new Date().toISOString() } : { completedBy: undefined, completedAt: undefined }) }
        }),
      } : card),
    }
    case 'add-item': return {
      ...state,
      cards: state.cards.map((card) => (card.type === 'task' || card.type === 'project') && card.id === action.cardId ? {
        ...card, subtasks: [...card.subtasks, action.item],
      } : card),
    }
    case 'update-item': return !isChecklist([action.item]) ? state : {
      ...state,
      cards: state.cards.map((card) => (card.type === 'task' || card.type === 'project') && card.id === action.cardId ? {
        ...card, subtasks: card.subtasks.map((item) => item.id === action.item.id ? action.item : item),
      } : card),
    }
    case 'delete-item': return {
      ...state,
      cards: state.cards.map((card) => (card.type === 'task' || card.type === 'project') && card.id === action.cardId ? {
        ...card, subtasks: card.subtasks.filter((item) => item.id !== action.itemId),
      } : card),
    }
    case 'move-item': return {
      ...state,
      cards: state.cards.map((card) => {
        if ((card.type !== 'task' && card.type !== 'project') || card.id !== action.cardId) return card
        const from = card.subtasks.findIndex((item) => item.id === action.itemId)
        const to = from + (action.direction === 'up' ? -1 : 1)
        if (from < 0 || to < 0 || to >= card.subtasks.length) return card
        const subtasks = [...card.subtasks]
        ;[subtasks[from], subtasks[to]] = [subtasks[to], subtasks[from]]
        return { ...card, subtasks }
      }),
    }
  }
}

export function useJourneyStore() {
  const [state, dispatch] = useReducer(journeyReducer, undefined, () => {
    try {
      return parseSavedState(localStorage.getItem(STORAGE_KEY))
        ?? parseSavedState(localStorage.getItem(LEGACY_STORAGE_KEY))
        ?? createInitialState()
    } catch {
      return createInitialState()
    }
  })
  const [storageAvailable, setStorageAvailable] = useState(true)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      setStorageAvailable(true)
    } catch {
      setStorageAvailable(false)
    }
  }, [state])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      const next = parseSavedState(event.newValue)
      if (next) dispatch({ type: 'hydrate', state: next })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return { state, dispatch, storageAvailable }
}
