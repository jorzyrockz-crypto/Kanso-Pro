import { describe, expect, it } from 'vitest'
import { legislatedActivityIllustration } from './legislatedActivityVisuals'

describe('legislated activity illustrations', () => {
  it.each([
    ['National Cancer Consciousness Week', 'health-wellbeing'],
    ['Philippine Environment Month', 'nature-safety'],
    ['National Teachers’ Month', 'learning-culture'],
    ['International Women’s Day', 'community-rights'],
    ['National Information and Communications Technology Month', 'innovation-civic'],
    ['Commemoration of the First Philippine Republic Day', 'heritage-commemoration'],
  ] as const)('uses a celebration-relevant illustration for %s', (title, illustration) => {
    expect(legislatedActivityIllustration(title)).toBe(illustration)
  })

  it('uses the heritage illustration as a quiet fallback for an unclassified observance', () => {
    expect(legislatedActivityIllustration('Annual Commemoration')).toBe('heritage-commemoration')
  })
})
