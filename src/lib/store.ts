import { useEffect, useReducer, useState } from 'react'
import { createInitialState, LEGACY_STORAGE_KEY, STORAGE_KEY } from '../data'
import type { JourneyAction, JourneyCard, JourneyState } from '../types'
import { isValidDate } from './journey'
import { isOccasionChoice } from './occasions'

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isChecklist(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 1000 && value.every((item: unknown) => {
    if (!item || typeof item !== 'object') return false
    const entry = item as Record<string, unknown>
    return isString(entry.id) && isString(entry.title) && typeof entry.done === 'boolean'
      && (entry.assignee === undefined || isString(entry.assignee))
      && (entry.label === undefined || isString(entry.label))
  }) && new Set(value.map((item) => item.id)).size === value.length
}

function isCard(value: unknown): value is JourneyCard {
  if (!value || typeof value !== 'object') return false
  const card = value as Record<string, unknown>
  if (!isString(card.id) || !isString(card.title) || !isValidDate(card.date)
    || !['left', 'right'].includes(String(card.side)) || !isString(card.context)
    || (card.quiet !== undefined && typeof card.quiet !== 'boolean')
    || (card.backlog !== undefined && typeof card.backlog !== 'boolean')
    || (card.isCustom !== undefined && typeof card.isCustom !== 'boolean')) return false
  if (card.type === 'event') return typeof card.allDay === 'boolean' && typeof card.holiday === 'boolean'
    && isString(card.owner) && isString(card.organization) && isString(card.location)
    && (card.time === undefined || isString(card.time)) && (card.endTime === undefined || isString(card.endTime))
    && (card.occasion === undefined || isOccasionChoice(card.occasion))
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
    && (card.attachment === undefined || (!!card.attachment && typeof card.attachment === 'object'
      && isString((card.attachment as Record<string, unknown>).id)
      && ['audio', 'image'].includes(String((card.attachment as Record<string, unknown>).kind))
      && isString((card.attachment as Record<string, unknown>).name)
      && isString((card.attachment as Record<string, unknown>).mimeType)
      && typeof (card.attachment as Record<string, unknown>).size === 'number'
      && ((card.attachment as Record<string, unknown>).durationSeconds === undefined || typeof (card.attachment as Record<string, unknown>).durationSeconds === 'number')
      && ((card.attachment as Record<string, unknown>).width === undefined || typeof (card.attachment as Record<string, unknown>).width === 'number')
      && ((card.attachment as Record<string, unknown>).height === undefined || typeof (card.attachment as Record<string, unknown>).height === 'number')
      && ((card.attachment as Record<string, unknown>).storage === undefined || (card.attachment as Record<string, unknown>).storage === 'firestore')))
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
    case 'update-note': return {
      ...state,
      cards: state.cards.map((card) => card.type === 'note' && card.id === action.id ? {
        ...card,
        ...(action.title !== undefined ? { title: action.title } : {}),
        ...(action.body !== undefined ? { body: action.body } : {}),
        ...(action.tags !== undefined ? { tags: action.tags } : {}),
        ...(action.category !== undefined ? { category: action.category } : {}),
        ...(action.reminderAt !== undefined ? { reminderAt: action.reminderAt } : {}),
        ...(action.noteKind !== undefined ? { noteKind: action.noteKind } : {}),
        ...(action.attachment !== undefined ? { attachment: action.attachment } : {}),
        ...(action.updatedAt !== undefined ? { updatedAt: action.updatedAt } : {}),
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
        ...card, subtasks: card.subtasks.map((item) => item.id === action.itemId ? { ...item, done: !item.done } : item),
      } : card),
    }
    case 'add-item': return {
      ...state,
      cards: state.cards.map((card) => (card.type === 'task' || card.type === 'project') && card.id === action.cardId ? {
        ...card, subtasks: [...card.subtasks, action.item],
      } : card),
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
