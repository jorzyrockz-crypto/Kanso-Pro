import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { APPEARANCE_STORAGE_KEY, COLOR_SCHEME_QUERY, appearanceBootstrapScript, appearanceThemeColor, parseAppearancePreferences, parseColorMode, resolveColorScheme, serializeAppearancePreferences, serializeColorMode } from './appearance'
import type { AppearancePreferences, BackgroundGradient, ColorMode } from './appearance'

const modes: ColorMode[] = ['light', 'dark', 'auto']
const backgrounds: BackgroundGradient[] = ['sky', 'dawn', 'lagoon', 'twilight']

const defaultAppearance = (mode: ColorMode): AppearancePreferences => ({ mode, background: 'sky' })

describe('device appearance preferences', () => {
  it.each(modes)('keeps version-one color-mode values compatible and maps them to Sky', (mode) => {
    const raw = serializeColorMode(mode)
    expect(JSON.parse(raw)).toEqual({ version: 1, mode })
    expect(parseColorMode(raw)).toBe(mode)
    expect(parseAppearancePreferences(raw)).toEqual(defaultAppearance(mode))
  })
  it.each(modes.flatMap((mode) => backgrounds.map((background) => ({ mode, background }))))('round-trips version-two $mode / $background preferences outside the journey schema', (preferences) => {
    const raw = serializeAppearancePreferences(preferences)
    expect(JSON.parse(raw)).toEqual({ version: 2, ...preferences })
    expect(parseAppearancePreferences(raw)).toEqual(preferences)
  })
  it.each([null, '', 'dark', 'null', '[]', '1', 'true', '{}', '{invalid', '{"version":2,"mode":"dark"}', '{"version":2,"mode":"dark","background":"custom"}', '{"version":2,"mode":"DARK","background":"sky"}', '{"version":2,"mode":true,"background":"sky"}', '{"version":1,"mode":"system"}', '{"version":1,"mode":"<script>"}'])('rejects malformed or unsupported values: %s', (raw) => {
    expect(parseAppearancePreferences(raw)).toBeNull()
  })
  it.each(modes.flatMap((mode) => [true, false].map((systemDark) => ({ mode, systemDark }))))('resolves $mode with systemDark=$systemDark', ({ mode, systemDark }) => {
    expect(resolveColorScheme(mode, systemDark)).toBe(mode === 'auto' ? systemDark ? 'dark' : 'light' : mode)
  })
  it.each(backgrounds.flatMap((background) => (['light', 'dark'] as const).map((scheme) => ({ background, scheme }))))('provides a browser theme color for $scheme $background', ({ scheme, background }) => {
    expect(appearanceThemeColor(scheme, background)).toMatch(/^#[\da-f]{6}$/i)
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
  it.each(modes.flatMap((mode) => [true, false].map((systemDark) => ({ mode, systemDark }))))('applies saved legacy $mode with Sky before React', ({ mode, systemDark }) => {
    const { dataset, meta } = boot(serializeColorMode(mode), systemDark)
    const scheme = resolveColorScheme(mode, systemDark)
    expect(dataset).toEqual({ colorMode: mode, theme: scheme, background: 'sky' })
    expect(meta.setAttribute).toHaveBeenCalledWith('content', appearanceThemeColor(scheme, 'sky'))
  })
  it('applies a saved gradient before React without waiting for the application bundle', () => {
    const preferences: AppearancePreferences = { mode: 'auto', background: 'twilight' }
    const { dataset, meta } = boot(serializeAppearancePreferences(preferences), true)
    expect(dataset).toEqual({ colorMode: 'auto', theme: 'dark', background: 'twilight' })
    expect(meta.setAttribute).toHaveBeenCalledWith('content', appearanceThemeColor('dark', 'twilight'))
  })
  it.each([null, 'not JSON', '{"version":9,"mode":"light"}', '{"version":2,"mode":"light","background":"neon"}'])('defaults to Auto and Sky without mutating journey data for %s', (raw) => {
    expect(boot(raw, true).dataset).toEqual({ colorMode: 'auto', theme: 'dark', background: 'sky' })
  })
  it('survives blocked storage, missing media queries, and absent optional browser metadata', () => {
    expect(boot(null, true, true).dataset).toEqual({ colorMode: 'auto', theme: 'dark', background: 'sky' })
    expect(boot(null, false, true, true, true).dataset).toEqual({ colorMode: 'auto', theme: 'light', background: 'sky' })
  })
})
