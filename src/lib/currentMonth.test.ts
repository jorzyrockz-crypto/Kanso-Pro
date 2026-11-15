import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentLocalMonth, nextLocalDayDelay } from './currentMonth'

const originalTimeZone = process.env.TZ
afterEach(() => {
  vi.useRealTimers()
  if (originalTimeZone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimeZone
})

describe('the real local month used by sign-in', () => {
  it('reads the actual clock instead of the sample journey or a fixed year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2029, 2, 18, 9))
    expect(currentLocalMonth()).toBe('2029-03')
    vi.setSystemTime(new Date(2030, 0, 1))
    expect(currentLocalMonth()).toBe('2030-01')
  })

  it('pads and resolves all twelve months in chronological order', () => {
    for (let month = 0; month < 12; month++) {
      expect(currentLocalMonth(new Date(2028, month, 15, 12))).toBe(`2028-${String(month + 1).padStart(2, '0')}`)
    }
  })

  it('uses the device timezone rather than an ISO/UTC date slice at month boundaries', () => {
    const instant = new Date('2027-01-31T16:30:00Z')
    process.env.TZ = 'Asia/Manila'
    expect(currentLocalMonth(instant)).toBe('2027-02')
    process.env.TZ = 'America/Los_Angeles'
    expect(currentLocalMonth(instant)).toBe('2027-01')
  })

  it('recognizes leap day and the December-to-January year transition', () => {
    process.env.TZ = 'UTC'
    expect(currentLocalMonth(new Date('2028-02-29T23:59:59Z'))).toBe('2028-02')
    expect(currentLocalMonth(new Date('2028-03-01T00:00:00Z'))).toBe('2028-03')
    expect(currentLocalMonth(new Date('2028-12-31T23:59:59Z'))).toBe('2028-12')
    expect(currentLocalMonth(new Date('2029-01-01T00:00:00Z'))).toBe('2029-01')
  })
})

describe('local-midnight scene refresh scheduling', () => {
  it('refreshes just after midnight without a month-long overflowing browser timeout', () => {
    process.env.TZ = 'UTC'
    expect(nextLocalDayDelay(new Date('2026-11-30T23:59:59Z'))).toBe(1050)
    expect(nextLocalDayDelay(new Date('2026-12-01T00:00:00Z'))).toBe(86_400_050)
    expect(nextLocalDayDelay(new Date('2026-12-31T23:59:59.999Z'))).toBe(100)
  })

  it('uses the next local date for 23- and 25-hour daylight-saving days', () => {
    process.env.TZ = 'America/Los_Angeles'
    expect(nextLocalDayDelay(new Date(2026, 2, 8, 0))).toBe(23 * 3_600_000 + 50)
    expect(nextLocalDayDelay(new Date(2026, 10, 1, 0))).toBe(25 * 3_600_000 + 50)
  })
})
