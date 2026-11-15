import type { CardType, ComposerOptions, Destination, Workspace } from '../types'
import { isValidDate } from './journey'

export const WORKSPACE_PATHS: Record<Workspace, string> = {
  calendar: '/calendar',
  tasks: '/tasks',
  project: '/projects',
  journal: '/journal',
}

export const WORKSPACE_TYPES: Record<Workspace, CardType> = {
  calendar: 'event', tasks: 'task', project: 'project', journal: 'note',
}

export const PAGE_LINKS = [
  { path: '/', label: 'Timeline', page: 'timeline' },
  { path: '/calendar', label: 'Calendar', page: 'calendar' },
  { path: '/tasks', label: 'Tasks', page: 'tasks' },
  { path: '/projects', label: 'Projects', page: 'project' },
  { path: '/journal', label: 'Journal', page: 'journal' },
] as const

export const SETTINGS_SECTIONS = [
  { id: 'account', label: 'Profile & account' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'workspace', label: 'Workspace & backup' },
  { id: 'privacy', label: 'Privacy & storage' },
  { id: 'about', label: 'About & help' },
] as const

export function destinationPath(destination: Destination): string {
  const base = WORKSPACE_PATHS[destination.page]
  return destination.cardId ? `${base}/${encodeURIComponent(destination.cardId)}` : base
}

export function composerPath(options: ComposerOptions = {}): string {
  const query = new URLSearchParams()
  if (options.type) query.set('type', options.type)
  if (options.date && isValidDate(options.date)) query.set('date', options.date)
  return `/new${query.size ? `?${query}` : ''}`
}

export function composerOptions(search: string): ComposerOptions {
  const query = new URLSearchParams(search)
  const type = query.get('type')
  const date = query.get('date')
  return {
    ...(type && ['event', 'task', 'project', 'note'].includes(type) ? { type: type as CardType } : {}),
    ...(isValidDate(date) ? { date } : {}),
  }
}

export function pageForPath(path: string, search = '') {
  const pathname = path.replace(/\/+$/, '').toLowerCase() || '/'
  if (pathname === '/new') return { label: 'New card', page: 'new' as const }
  if (pathname === '/notifications') return { label: 'Notifications', page: 'notifications' as const }
  if (pathname === '/whats-new') return { label: 'What’s new', page: 'whats-new' as const }
  if (pathname === '/settings') return { label: 'Settings', page: 'settings' as const }
  if (pathname === '/account') return { label: 'My workspace', page: 'account' as const }
  if (pathname === '/sign-in') {
    const mode = new URLSearchParams(search).get('mode')
    return { label: mode === 'create' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in', page: 'sign-in' as const }
  }
  return PAGE_LINKS.find(({ path }) => path === '/' ? pathname === '/' : pathname === path || (pathname.startsWith(`${path}/`) && !pathname.slice(path.length + 1).includes('/')))
    ?? { label: 'Page not found', page: 'not-found' as const }
}
