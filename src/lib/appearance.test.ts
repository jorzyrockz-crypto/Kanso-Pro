import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { APPEARANCE_STORAGE_KEY, COLOR_SCHEME_QUERY, appearanceBootstrapScript, parseColorMode, resolveColorScheme, serializeColorMode } from './appearance'
import type { ColorMode } from './appearance'

const modes: ColorMode[] = ['light', 'dark', 'auto']

describe('device appearance preferences', () => {
  it.each(modes)('round-trips only the version and %s mode, outside the journey schema', (mode) => {
    const raw = serializeColorMode(mode)
    expect(JSON.parse(raw)).toEqual({ version: 1, mode })
    expect(parseColorMode(raw)).toBe(mode)
  })
  it.each([null, '', 'dark', 'null', '[]', '1', 'true', '{}', '{invalid', '{"version":2,"mode":"dark"}', '{"mode":"light"}', '{"version":1,"mode":"system"}', '{"version":1,"mode":"DARK"}', '{"version":1,"mode":true}', '{"version":1,"mode":"<script>"}'])('rejects malformed or unsupported values: %s', (raw) => {
    expect(parseColorMode(raw)).toBeNull()
  })
  it.each(modes.flatMap((mode) => [true, false].map((systemDark) => ({ mode, systemDark }))))('resolves $mode with systemDark=$systemDark', ({ mode, systemDark }) => {
    expect(resolveColorScheme(mode, systemDark)).toBe(mode === 'auto' ? systemDark ? 'dark' : 'light' : mode)
  })
})

describe('the synchronous before-paint script', () => {
  function boot(raw: string | null, systemDark: boolean, blocked = false, missingMedia = false, missingMeta = false) {
    const dataset: Record<string, string> = {}
    const meta = { setAttribute: vi.fn() }
    const storage = { getItem: vi.fn(() => { if (blocked) throw new Error('Storage blocked'); return raw }) }
    const media = vi.fn(() => ({ matches: systemDark }))
    runInNewContext(appearanceBootstrapScript(), {
      document: { documentElement: { dataset }, querySelector: () => missingMeta ? null : meta },
      localStorage: storage, window: missingMedia ? {} : { matchMedia: media },
    })
    expect(storage.getItem).toHaveBeenCalledWith(APPEARANCE_STORAGE_KEY)
    if (!missingMedia) expect(media).toHaveBeenCalledWith(COLOR_SCHEME_QUERY)
    return { dataset, meta }
  }
  it.each(modes.flatMap((mode) => [true, false].map((systemDark) => ({ mode, systemDark }))))('applies saved $mode with systemDark=$systemDark before React', ({ mode, systemDark }) => {
    const { dataset, meta } = boot(serializeColorMode(mode), systemDark)
    const scheme = resolveColorScheme(mode, systemDark)
    expect(dataset).toEqual({ colorMode: mode, theme: scheme })
    expect(meta.setAttribute).toHaveBeenCalledWith('content', scheme === 'dark' ? '#0c1724' : '#eaf5fc')
  })
  it.each([null, 'not JSON', '{"version":9,"mode":"light"}'])('defaults to Auto without mutating journey data for %s', (raw) => {
    expect(boot(raw, true).dataset).toEqual({ colorMode: 'auto', theme: 'dark' })
  })
  it('survives blocked storage, missing media queries, and absent optional browser metadata', () => {
    expect(boot(null, true, true).dataset).toEqual({ colorMode: 'auto', theme: 'dark' })
    expect(boot(null, false, true, true, true).dataset).toEqual({ colorMode: 'auto', theme: 'light' })
  })
})
