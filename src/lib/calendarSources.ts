import { useCallback, useEffect, useMemo, useState } from 'react'
import { isValidDate } from './journey'

export const CALENDAR_SOURCES_STORAGE_KEY = 'kanso-pro:calendar-sources:v1'
const MAX_IMPORTED_SOURCES = 12
const MAX_IMPORTED_ENTRIES = 500
const MAX_PDF_BYTES = 25 * 1024 * 1024

export interface CalendarSourceEntry {
  id: string
  sourceId: string
  title: string
  date: string
  endDate?: string
  detail?: string
}

export type CalendarRecurringRule =
  | { id: string; title: string; month: number; kind: 'month'; detail?: string }
  | { id: string; title: string; month: number; kind: 'date'; day: number; detail?: string }
  | { id: string; title: string; month: number; kind: 'range'; startDay: number; endDay: number; detail?: string }
  | { id: string; title: string; month: number; kind: 'week'; week: 1 | 2 | 3 | 4 | 'last'; detail?: string }
  | { id: string; title: string; month: number; kind: 'nth-weekday'; nth: 1 | 2 | 3 | 4 | 5; weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; detail?: string }
  | { id: string; title: string; month: number; kind: 'week-containing'; day: number; detail?: string }
  | { id: string; title: string; kind: 'cross-month-range'; startMonth: number; startDay: number; endMonth: number; endDay: number; detail?: string }

export interface CalendarSource {
  id: string
  label: string
  shortLabel: string
  enabled: boolean
  provenance: string
  reference: string
  imported: boolean
  entries: CalendarSourceEntry[]
  recurringRules?: CalendarRecurringRule[]
}

interface StoredLocalSource {
  id: string
  label: string
  sourceFileName: string
  enabled: boolean
  importedAt: string
  entries: CalendarSourceEntry[]
}

interface CalendarSourcePreferences {
  version: 1
  depedEnabled: boolean
  legislatedEnabled: boolean
  localSources: StoredLocalSource[]
}

export interface MemoImportResult {
  source: StoredLocalSource
  message: string
}

export interface CalendarSourcesController {
  sources: CalendarSource[]
  storageAvailable: boolean
  setDepEdEnabled: (enabled: boolean) => void
  setLegislatedEnabled: (enabled: boolean) => void
  setSourceEnabled: (sourceId: string, enabled: boolean) => void
  removeSource: (sourceId: string) => void
  importMemo: (file: File) => Promise<MemoImportResult>
}

interface PdfTextItem {
  str: string
  transform: number[]
}

function stringAtMost(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max
}

function isEntry(value: unknown, sourceId: string): value is CalendarSourceEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return stringAtMost(entry.id, 160) && entry.sourceId === sourceId && stringAtMost(entry.title, 280)
    && isValidDate(entry.date) && (entry.endDate === undefined || isValidDate(entry.endDate))
    && (entry.detail === undefined || stringAtMost(entry.detail, 1200))
}

function isStoredLocalSource(value: unknown): value is StoredLocalSource {
  if (!value || typeof value !== 'object') return false
  const source = value as Record<string, unknown>
  if (!stringAtMost(source.id, 120) || !stringAtMost(source.label, 180) || !stringAtMost(source.sourceFileName, 255)
    || typeof source.enabled !== 'boolean' || !stringAtMost(source.importedAt, 40)
    || !Array.isArray(source.entries) || source.entries.length > MAX_IMPORTED_ENTRIES) return false
  const sourceId = source.id
  return source.entries.every((entry) => isEntry(entry, sourceId))
}

export function parseCalendarSourcePreferences(raw: string | null): CalendarSourcePreferences | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const data = value as Record<string, unknown>
    if (data.version !== 1 || typeof data.depedEnabled !== 'boolean'
      || (data.legislatedEnabled !== undefined && typeof data.legislatedEnabled !== 'boolean')
      || !Array.isArray(data.localSources) || data.localSources.length > MAX_IMPORTED_SOURCES
      || !data.localSources.every(isStoredLocalSource)) return null
    return {
      version: 1,
      depedEnabled: data.depedEnabled,
      legislatedEnabled: data.legislatedEnabled === true,
      localSources: data.localSources,
    }
  } catch {
    return null
  }
}

function initialPreferences(): CalendarSourcePreferences {
  return { version: 1, depedEnabled: false, legislatedEnabled: false, localSources: [] }
}

function sourceFromLocal(source: StoredLocalSource): CalendarSource {
  return {
    id: source.id,
    label: source.label,
    shortLabel: 'Local memo',
    enabled: source.enabled,
    provenance: `Imported from ${source.sourceFileName} on ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(source.importedAt))}.`,
    reference: 'Read locally in this browser. The original PDF is not stored or uploaded.',
    imported: true,
    entries: source.entries,
  }
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function dateFor(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function recurringEntry(sourceId: string, rule: CalendarRecurringRule, year: number, date: string, endDate?: string): CalendarSourceEntry {
  return { id: `${sourceId}-${rule.id}-${year}`, sourceId, title: rule.title, date, ...(endDate ? { endDate } : {}), ...(rule.detail ? { detail: rule.detail } : {}) }
}

function entriesForRuleInMonth(sourceId: string, rule: CalendarRecurringRule, year: number, month: number): CalendarSourceEntry[] {
  if (rule.kind === 'cross-month-range') {
    if (month !== rule.startMonth && month !== rule.endMonth) return []
    const crossesYear = rule.endMonth < rule.startMonth
    const startYear = crossesYear && month === rule.endMonth ? year - 1 : year
    const endYear = crossesYear ? startYear + 1 : startYear
    return [recurringEntry(sourceId, rule, startYear, dateFor(startYear, rule.startMonth, rule.startDay), dateFor(endYear, rule.endMonth, rule.endDay))]
  }
  if (rule.month !== month) return []
  const monthEnd = daysInMonth(year, month)
  if (rule.kind === 'month') return [recurringEntry(sourceId, rule, year, dateFor(year, month, 1), dateFor(year, month, monthEnd))]
  if (rule.kind === 'date') return [recurringEntry(sourceId, rule, year, dateFor(year, month, rule.day))]
  if (rule.kind === 'range') return [recurringEntry(sourceId, rule, year, dateFor(year, month, rule.startDay), dateFor(year, month, Math.min(rule.endDay, monthEnd)))]
  if (rule.kind === 'week') {
    const start = rule.week === 'last' ? Math.max(1, monthEnd - 6) : (rule.week - 1) * 7 + 1
    const end = rule.week === 'last' ? monthEnd : Math.min(monthEnd, start + 6)
    return [recurringEntry(sourceId, rule, year, dateFor(year, month, start), dateFor(year, month, end))]
  }
  if (rule.kind === 'nth-weekday') {
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
    const day = 1 + ((rule.weekday - firstWeekday + 7) % 7) + (rule.nth - 1) * 7
    return day <= monthEnd ? [recurringEntry(sourceId, rule, year, dateFor(year, month, day))] : []
  }
  const weekday = new Date(Date.UTC(year, month - 1, rule.day)).getUTCDay()
  const start = Math.max(1, rule.day - ((weekday + 6) % 7))
  const end = Math.min(monthEnd, start + 6)
  return [recurringEntry(sourceId, rule, year, dateFor(year, month, start), dateFor(year, month, end))]
}

/** Returns enabled static and permanent-recurring source entries that overlap a calendar month. */
export function calendarSourceEntriesForMonth(sources: CalendarSource[], month: string): CalendarSourceEntry[] {
  const year = Number(month.slice(0, 4))
  return sources.filter((source) => source.enabled).flatMap((source) => [
    ...source.entries.filter((entry) => entry.date.slice(0, 7) <= month && (entry.endDate ?? entry.date).slice(0, 7) >= month),
    ...(source.recurringRules ?? []).flatMap((rule) => entriesForRuleInMonth(source.id, rule, year, Number(month.slice(5, 7)))),
  ])
}

/**
 * Extract date-led lines from a selectable-text memorandum. It intentionally keeps only
 * the derived entries, never the PDF bytes. Scanned/image-only PDFs need a text-accessible
 * copy because browser PDF text extraction is not OCR.
 */
export function parseMemoCalendarText(text: string, sourceId: string): CalendarSourceEntry[] {
  const monthName = 'January|February|March|April|May|June|July|August|September|October|November|December'
  const dateLine = new RegExp(`\\b(${monthName})\\s+(\\d{1,2})(?:\\s*(?:-|–|to)\\s*(\\d{1,2}))?,?\\s+(20\\d{2})\\b`, 'i')
  const monthHeading = new RegExp(`\\b(${monthName})\\s+(20\\d{2})\\b`, 'i')
  const tableDate = /^(\d{1,2})(?:\s*(?:-|–|to)\s*(\d{1,2}))?\s+(.+)$/
  const numericDate = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/
  const cleanLines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const entries: CalendarSourceEntry[] = []
  const seen = new Set<string>()
  let activeMonth = 0
  let activeYear = 0

  const addEntry = (date: string, title: string, endDate?: string) => {
    const trimmedTitle = title.slice(0, 280).trim()
    if (!isValidDate(date) || !trimmedTitle || trimmedTitle.length < 3 || /^[\d\s,./&-]+$/.test(trimmedTitle)) return
    const validEndDate = endDate && isValidDate(endDate) ? endDate : undefined
    const key = `${date}-${validEndDate ?? ''}-${trimmedTitle.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    entries.push({ id: `${sourceId}-entry-${entries.length + 1}`, sourceId, title: trimmedTitle, date, ...(validEndDate ? { endDate: validEndDate } : {}) })
  }

  for (let index = 0; index < cleanLines.length && entries.length < MAX_IMPORTED_ENTRIES; index += 1) {
    const line = cleanLines[index]
    const named = line.match(dateLine)
    const numeric = line.match(numericDate)
    const heading = line.match(monthHeading)
    if (heading) {
      activeMonth = new Date(`${heading[1]} 1, ${heading[2]}`).getMonth() + 1
      activeYear = Number(heading[2])
    }

    if (named) {
      const month = new Date(`${named[1]} 1, ${named[4]}`).getMonth() + 1
      const date = `${named[4]}-${String(month).padStart(2, '0')}-${String(Number(named[2])).padStart(2, '0')}`
      const endDate = named[3] ? `${named[4]}-${String(month).padStart(2, '0')}-${String(Number(named[3])).padStart(2, '0')}` : undefined
      const title = line.slice((named.index ?? 0) + named[0].length).replace(/^[\s:–-]+/, '') || cleanLines[index + 1] || ''
      addEntry(date, title, endDate)
      continue
    }
    if (numeric) {
      const date = `${numeric[1]}-${String(Number(numeric[2])).padStart(2, '0')}-${String(Number(numeric[3])).padStart(2, '0')}`
      const title = line.slice((numeric.index ?? 0) + numeric[0].length).replace(/^[\s:–-]+/, '') || cleanLines[index + 1] || ''
      addEntry(date, title)
      continue
    }

    const row = line.match(tableDate)
    if (row && activeMonth && activeYear) {
      const date = `${activeYear}-${String(activeMonth).padStart(2, '0')}-${String(Number(row[1])).padStart(2, '0')}`
      const endDate = row[2] ? `${activeYear}-${String(activeMonth).padStart(2, '0')}-${String(Number(row[2])).padStart(2, '0')}` : undefined
      addEntry(date, row[3], endDate)
    }
  }

  return entries
}

async function readPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const document = await pdfjs.getDocument({ data: bytes }).promise
  try {
    const pages: string[] = []
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      const lines = new Map<number, PdfTextItem[]>()
      for (const item of content.items) {
        if (!('str' in item) || typeof item.str !== 'string') continue
        const textItem = item as PdfTextItem
        const y = Math.round(textItem.transform[5] ?? 0)
        const line = lines.get(y) ?? []
        line.push(textItem)
        lines.set(y, line)
      }
      pages.push([...lines.entries()]
        .sort(([first], [second]) => second - first)
        .map(([, line]) => line.sort((first, second) => (first.transform[4] ?? 0) - (second.transform[4] ?? 0)).map((item) => item.str).join(' '))
        .join('\n'))
    }
    return pages.join('\n')
  } finally {
    await document.destroy()
  }
}

function safeName(fileName: string) {
  return fileName.replace(/\.pdf$/i, '').replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150) || 'Local memorandum'
}

export function useCalendarSources(depedEntries: CalendarSourceEntry[], legislatedRules: CalendarRecurringRule[]): CalendarSourcesController {
  const [preferences, setPreferences] = useState<CalendarSourcePreferences>(() => {
    try { return parseCalendarSourcePreferences(localStorage.getItem(CALENDAR_SOURCES_STORAGE_KEY)) ?? initialPreferences() }
    catch { return initialPreferences() }
  })
  const [storageAvailable, setStorageAvailable] = useState(true)

  useEffect(() => {
    try {
      localStorage.setItem(CALENDAR_SOURCES_STORAGE_KEY, JSON.stringify(preferences))
      setStorageAvailable(true)
    } catch {
      setStorageAvailable(false)
    }
  }, [preferences])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CALENDAR_SOURCES_STORAGE_KEY) return
      const next = parseCalendarSourcePreferences(event.newValue)
      if (next) setPreferences(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const sources = useMemo<CalendarSource[]>(() => [
    {
      id: 'deped-sy-2026-2027',
      label: 'DepEd Calendar',
      shortLabel: 'DepEd',
      enabled: preferences.depedEnabled,
      provenance: 'Verified from DepEd Order No. 009, s. 2026, Annex B (pp. 20–27).',
      reference: 'Three-Term School Calendar in Basic Education for SY 2026–2027.',
      imported: false,
      entries: depedEntries,
    },
    {
      id: 'deped-legislated-activities',
      label: 'Legislated activities & celebrations',
      shortLabel: 'DepEd observance',
      enabled: preferences.legislatedEnabled,
      provenance: 'Verified from DepEd Order No. 009, s. 2026, Annex D (pp. 29–55).',
      reference: 'Calendar of Legislated Activities and Celebrations; recurring rules apply every year.',
      imported: false,
      entries: [],
      recurringRules: legislatedRules,
    },
    ...preferences.localSources.map(sourceFromLocal),
  ], [depedEntries, legislatedRules, preferences])

  const setDepEdEnabled = useCallback((enabled: boolean) => setPreferences((current) => ({ ...current, depedEnabled: enabled })), [])
  const setLegislatedEnabled = useCallback((enabled: boolean) => setPreferences((current) => ({ ...current, legislatedEnabled: enabled })), [])
  const setSourceEnabled = useCallback((sourceId: string, enabled: boolean) => {
    if (sourceId === 'deped-sy-2026-2027') { setDepEdEnabled(enabled); return }
    if (sourceId === 'deped-legislated-activities') { setLegislatedEnabled(enabled); return }
    setPreferences((current) => ({ ...current, localSources: current.localSources.map((source) => source.id === sourceId ? { ...source, enabled } : source) }))
  }, [setDepEdEnabled, setLegislatedEnabled])
  const removeSource = useCallback((sourceId: string) => {
    setPreferences((current) => ({ ...current, localSources: current.localSources.filter((source) => source.id !== sourceId) }))
  }, [])

  const importMemo = useCallback(async (file: File): Promise<MemoImportResult> => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Choose a PDF memorandum to import.')
    if (file.size > MAX_PDF_BYTES) throw new Error('This PDF is larger than 25 MB. Choose a smaller local memorandum file.')
    const id = `local-memo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    let text = ''
    try { text = await readPdfText(file) } catch { throw new Error('Kanso could not read this PDF in the browser. The file was not uploaded or saved.') }
    const parsedEntries = parseMemoCalendarText(text, id)
    if (!parsedEntries.length) throw new Error('No date-led text was found. This looks like an image-only scan; choose a text-accessible PDF. The file was not uploaded or saved.')
    const source: StoredLocalSource = {
      id,
      label: `DepEd memorandum · ${safeName(file.name)}`,
      sourceFileName: file.name.slice(0, 255),
      enabled: true,
      importedAt: new Date().toISOString(),
      entries: parsedEntries,
    }
    setPreferences((current) => ({ ...current, localSources: [...current.localSources.slice(-(MAX_IMPORTED_SOURCES - 1)), source] }))
    return { source, message: `${parsedEntries.length} dated ${parsedEntries.length === 1 ? 'entry' : 'entries'} were read locally and added to Calendar.` }
  }, [])

  return { sources, storageAvailable, setDepEdEnabled, setLegislatedEnabled, setSourceEnabled, removeSource, importMemo }
}
