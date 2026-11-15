import { FOCUS_DATE } from '../data'
import { isValidDate } from './journey'

export const MONTH_SCENES = [
  { id: '01', name: 'January', title: 'Fresh horizons', canvas: '#eef6fc', wash: '#dcebf5', ink: '#88abc4', accent: '#a3cbd6', warm: '#e9d5b1' },
  { id: '02', name: 'February', title: 'Little connections', canvas: '#f4f5fc', wash: '#e9e2f2', ink: '#ac9fbc', accent: '#d9b6c6', warm: '#e8ced3' },
  { id: '03', name: 'March', title: 'Room to grow', canvas: '#eff8f5', wash: '#deeee6', ink: '#88afa6', accent: '#b3ccaf', warm: '#e0dbb6' },
  { id: '04', name: 'April', title: 'In bloom', canvas: '#f7f6fc', wash: '#eae3f3', ink: '#a99cbe', accent: '#cfb8d8', warm: '#e8d7b3' },
  { id: '05', name: 'May', title: 'Sunlit days', canvas: '#f0f8fa', wash: '#dcedee', ink: '#84aeb5', accent: '#b0cfc0', warm: '#e8d5ac' },
  { id: '06', name: 'June', title: 'Rain garden', canvas: '#eef6fa', wash: '#dce9f0', ink: '#8fa9bf', accent: '#aacac3', warm: '#c5c3dc' },
  { id: '07', name: 'July', title: 'Drifting clouds', canvas: '#f0f6fc', wash: '#dfe9f5', ink: '#91acc8', accent: '#bbc9e1', warm: '#ead8bc' },
  { id: '08', name: 'August', title: 'Quiet shores', canvas: '#eef7fa', wash: '#dbecef', ink: '#83adb9', accent: '#b1d0cd', warm: '#dfd5b7' },
  { id: '09', name: 'September', title: 'New chapters', canvas: '#f3f6fb', wash: '#e1e8f2', ink: '#94a7bf', accent: '#b7c9bc', warm: '#e3cfb4' },
  { id: '10', name: 'October', title: 'Golden pause', canvas: '#f8f6f1', wash: '#ede7da', ink: '#b5a78f', accent: '#c9b89f', warm: '#e2c596' },
  { id: '11', name: 'November', title: 'Still moments', canvas: '#eff6f8', wash: '#dfecee', ink: '#8ca9b1', accent: '#b1c8be', warm: '#d9d7be' },
  { id: '12', name: 'December', title: 'Small wonders', canvas: '#f0f5fb', wash: '#e1e8f3', ink: '#96a8c4', accent: '#b7c9cf', warm: '#e2cfaa' },
] as const

export type MonthScene = typeof MONTH_SCENES[number]
export type MonthSceneId = MonthScene['id']

/** Accept a real month or date, never a partial/rolled-over URL value. */
export function normalizeMonth(value: unknown): string {
  if (isValidDate(value)) return value.slice(0, 7)
  if (typeof value === 'string' && isValidDate(`${value}-01`)) return value
  return FOCUS_DATE.slice(0, 7)
}

export function monthScene(value: unknown): MonthScene {
  return MONTH_SCENES[Number(normalizeMonth(value).slice(5, 7)) - 1]
}

/** One source of truth for the calendar title, date selection, and monthly artwork. */
export function calendarPeriod(query: URLSearchParams, cardDate?: string): { month: string; selectedDate: string | null } {
  const dateQuery = query.get('date')
  const monthQuery = query.get('month')
  const selectedDate = isValidDate(dateQuery) ? dateQuery : monthQuery ? null : cardDate ?? null
  const month = selectedDate?.slice(0, 7) ?? (isValidDate(`${monthQuery}-01`) ? monthQuery! : normalizeMonth(cardDate))
  return { month, selectedDate }
}

/** The last dated row reaching the reading area owns the timeline's month. */
export function monthAtPosition(markers: readonly { month: string; top: number }[], anchor: number, fallback: string, atEnd = false): string {
  // Short final rows may never reach the reading area before scrolling runs out.
  if (atEnd) return markers.at(-1)?.month ?? fallback
  let month = markers[0]?.month ?? fallback
  for (const marker of markers) {
    if (marker.top > anchor) break
    month = marker.month
  }
  return month
}
