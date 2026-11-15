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

export interface CalendarSource {
  id: string
  label: string
  shortLabel: string
  enabled: boolean
  provenance: string
  reference: string
  imported: boolean
  entries: CalendarSourceEntry[]
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
  localSources: StoredLocalSource[]
}

export interface MemoImportResult {
  source: StoredLocalSource
  message: string
}

export interface CalendarSourcesController {
  sources: CalendarSource[]
  entries: CalendarSourceEntry[]
  storageAvailable: boolean
  setDepEdEnabled: (enabled: boolean) => void
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
    if (data.version !== 1 || typeof data.depedEnabled !== 'boolean' || !Array.isArray(data.localSources)
      || data.localSources.length > MAX_IMPORTED_SOURCES || !data.localSources.every(isStoredLocalSource)) return null
    return data as unknown as CalendarSourcePreferences
  } catch {
    return null
  }
}

function initialPreferences(): CalendarSourcePreferences {
  return { version: 1, depedEnabled: false, localSources: [] }
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

export function useCalendarSources(depedEntries: CalendarSourceEntry[]): CalendarSourcesController {
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
    ...preferences.localSources.map(sourceFromLocal),
  ], [depedEntries, preferences])

  const entries = useMemo(() => sources.filter((source) => source.enabled).flatMap((source) => source.entries), [sources])
  const setDepEdEnabled = useCallback((enabled: boolean) => setPreferences((current) => ({ ...current, depedEnabled: enabled })), [])
  const setSourceEnabled = useCallback((sourceId: string, enabled: boolean) => {
    if (sourceId === 'deped-sy-2026-2027') { setDepEdEnabled(enabled); return }
    setPreferences((current) => ({ ...current, localSources: current.localSources.map((source) => source.id === sourceId ? { ...source, enabled } : source) }))
  }, [setDepEdEnabled])
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

  return { sources, entries, storageAvailable, setDepEdEnabled, setSourceEnabled, removeSource, importMemo }
}
