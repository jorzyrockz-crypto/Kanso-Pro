import { describe, expect, it } from 'vitest'
import { FOCUS_DATE } from '../data'
import { calendarPeriod, MONTH_SCENES, monthAtPosition, monthRange, monthScene, normalizeMonth } from './months'

describe('twelve original monthly scenes', () => {
  it('defines one distinct scene for every month, in calendar order', () => {
    expect(MONTH_SCENES).toHaveLength(12)
    expect(MONTH_SCENES.map((scene) => scene.id)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'])
    expect(new Set(MONTH_SCENES.map((scene) => scene.title)).size).toBe(12)
    expect(new Set(MONTH_SCENES.map((scene) => scene.canvas)).size).toBe(12)
    for (const scene of MONTH_SCENES) {
      for (const color of [scene.canvas, scene.wash, scene.ink, scene.accent, scene.warm]) expect(color).toMatch(/^#[\da-f]{6}$/i)
    }
  })

  it.each(MONTH_SCENES)('resolves $name for any valid year, month, or day', (scene) => {
    expect(monthScene(`2026-${scene.id}`)).toBe(scene)
    expect(monthScene(`2028-${scene.id}-01`)).toBe(scene)
    expect(monthScene(`2027-${scene.id}-28`)).toBe(scene)
  })

  it('normalizes valid dates without timezone conversions or loose prefix matching', () => {
    expect(normalizeMonth('2028-02-29')).toBe('2028-02')
    expect(normalizeMonth('2026-12')).toBe('2026-12')
    expect(normalizeMonth('2027-01-01')).toBe('2027-01')
    for (const value of [null, undefined, {}, 11, '', '2026-00', '2026-13', '2026-2', '2026-02-30', '2026-11-not-a-date', '<svg>']) {
      expect(normalizeMonth(value)).toBe(FOCUS_DATE.slice(0, 7))
      expect(monthScene(value).id).toBe('11')
    }
  })
})

describe('one calendar period for the page and its background', () => {
  it('uses the sample focus month with no selection', () => {
    expect(calendarPeriod(new URLSearchParams())).toEqual({ month: '2026-11', selectedDate: null })
  })

  it('opens a specific event’s actual month and date', () => {
    expect(calendarPeriod(new URLSearchParams(), '2027-03-16')).toEqual({ month: '2027-03', selectedDate: '2027-03-16' })
  })

  it('gives a valid date query precedence over a month or a linked card', () => {
    expect(calendarPeriod(new URLSearchParams('date=2028-02-29&month=2026-12'), '2026-11-02')).toEqual({ month: '2028-02', selectedDate: '2028-02-29' })
  })

  it('allows month navigation away from a linked event and clears day selection', () => {
    expect(calendarPeriod(new URLSearchParams('month=2027-01'), '2026-11-02')).toEqual({ month: '2027-01', selectedDate: null })
  })

  it('ignores invalid queries without choosing a different background from the page', () => {
    expect(calendarPeriod(new URLSearchParams('date=2026-02-30&month=2026-99'))).toEqual({ month: '2026-11', selectedDate: null })
    expect(calendarPeriod(new URLSearchParams('date=bad&month=2027-04'))).toEqual({ month: '2027-04', selectedDate: null })
    expect(calendarPeriod(new URLSearchParams('date=bad'), '2026-12-05')).toEqual({ month: '2026-12', selectedDate: '2026-12-05' })
  })
})

describe('a bounded slice of timeline months', () => {
  it('lists inclusive months across year boundaries in chronological order', () => {
    expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(monthRange('2026-11', '2026-11')).toEqual(['2026-11'])
    expect(monthRange('2027-01', '2026-12')).toEqual([])
  })
})

describe('the month currently being read on the timeline', () => {
  const markers = [
    { month: '2026-11', top: -500 }, { month: '2026-11', top: -200 },
    { month: '2026-12', top: 300 }, { month: '2027-01', top: 800 },
  ]
  it('follows the last dated row to reach the reading area', () => {
    expect(monthAtPosition(markers, 250, '2026-11')).toBe('2026-11')
    expect(monthAtPosition(markers, 300, '2026-11')).toBe('2026-12')
    expect(monthAtPosition(markers, 600, '2026-11')).toBe('2026-12')
    expect(monthAtPosition(markers, 900, '2026-11')).toBe('2027-01')
  })
  it('uses the first visible filtered month when all rows are below the header', () => {
    expect(monthAtPosition([{ month: '2027-04', top: 400 }], 280, '2026-11')).toBe('2027-04')
  })
  it('recognizes the last month at the end of a page even if its short row is below the reading area', () => {
    expect(monthAtPosition(markers, 600, '2026-11', true)).toBe('2027-01')
  })
  it('leaves an empty or fully filtered timeline with a safe fallback', () => {
    expect(monthAtPosition([], 300, '2026-11')).toBe('2026-11')
    expect(monthAtPosition([], 300, '2026-11', true)).toBe('2026-11')
  })
})
