import { describe, expect, it } from 'vitest'
import { DEPED_LEGISLATED_ACTIVITY_RULES } from '../data/depedLegislatedActivities'
import { DEPED_SY_2026_2027_ENTRIES } from '../data/depedSchoolCalendar2026'
import { calendarSourceEntriesForMonth, parseCalendarSourcePreferences, parseMemoCalendarText } from './calendarSources'

describe('calendar sources', () => {
  it('keeps the verified DepEd calendar as separate source entries', () => {
    expect(DEPED_SY_2026_2027_ENTRIES).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: 'deped-sy-2026-2027', date: '2026-06-08', title: 'Term 1 opening block', endDate: '2026-06-11' }),
      expect.objectContaining({ sourceId: 'deped-sy-2026-2027', date: '2026-11-30', title: 'Bonifacio Day' }),
      expect.objectContaining({ sourceId: 'deped-sy-2026-2027', date: '2027-04-08', title: 'PTA meeting, distribution of report cards, and end of Term 3' }),
    ]))
    expect(DEPED_SY_2026_2027_ENTRIES.every((entry) => !('type' in entry))).toBe(true)
  })

  it('expands Annex D observances for every year without converting them to cards', () => {
    const source = {
      id: 'deped-legislated-activities', label: 'Legislated activities', shortLabel: 'DepEd observance', enabled: true,
      provenance: 'Annex D', reference: 'Calendar of Legislated Activities and Celebrations', imported: false,
      entries: [], recurringRules: DEPED_LEGISLATED_ACTIVITY_RULES,
    }
    const october2026 = calendarSourceEntriesForMonth([source], '2026-10')
    const october2031 = calendarSourceEntriesForMonth([source], '2031-10')
    expect(october2026).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'World Teachers’ Day', date: '2026-10-05' }),
      expect.objectContaining({ title: 'National Teachers’ Month', date: '2026-09-05', endDate: '2026-10-05' }),
    ]))
    expect(october2031).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'World Teachers’ Day', date: '2031-10-05' }),
      expect.objectContaining({ title: 'National Teachers’ Month', date: '2031-09-05', endDate: '2031-10-05' }),
    ]))
  })

  it('reads date-led and month-headed table text without retaining a PDF', () => {
    expect(parseMemoCalendarText('June 8–11, 2027 Opening Block\nJune 12, 2027 Independence Day\nJuly 2027\n3-7 Brigada Eskwela', 'memo-1')).toEqual([
      { id: 'memo-1-entry-1', sourceId: 'memo-1', date: '2027-06-08', endDate: '2027-06-11', title: 'Opening Block' },
      { id: 'memo-1-entry-2', sourceId: 'memo-1', date: '2027-06-12', title: 'Independence Day' },
      { id: 'memo-1-entry-3', sourceId: 'memo-1', date: '2027-07-03', endDate: '2027-07-07', title: 'Brigada Eskwela' },
    ])
  })

  it('validates only bounded local source metadata and extracted entries', () => {
    const raw = JSON.stringify({
      version: 1,
      depedEnabled: true,
      localSources: [{
        id: 'memo-1', label: 'DepEd memorandum', sourceFileName: 'memo.pdf', enabled: true,
        importedAt: '2026-11-15T00:00:00.000Z',
        entries: [{ id: 'memo-1-entry-1', sourceId: 'memo-1', title: 'Opening Block', date: '2027-06-08' }],
      }],
    })
    expect(parseCalendarSourcePreferences(raw)?.localSources[0]?.entries[0]?.title).toBe('Opening Block')
    expect(parseCalendarSourcePreferences(raw)?.legislatedEnabled).toBe(false)
    expect(parseCalendarSourcePreferences(JSON.stringify({ ...JSON.parse(raw), legislatedEnabled: true }))?.legislatedEnabled).toBe(true)
    expect(parseCalendarSourcePreferences(JSON.stringify({ version: 1, depedEnabled: true, localSources: [{ id: 'memo-1', entries: [] }] }))).toBeNull()
  })
})
