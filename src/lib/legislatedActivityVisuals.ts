export type LegislatedActivityIllustration =
  | 'health-wellbeing'
  | 'learning-culture'
  | 'nature-safety'
  | 'community-rights'
  | 'innovation-civic'
  | 'heritage-commemoration'

const themedKeywords: ReadonlyArray<[LegislatedActivityIllustration, readonly string[]]> = [
  ['health-wellbeing', [
    'health', 'cancer', 'autism', 'down syndrome', 'dental', 'heart', 'leprosy', 'firecracker injury',
    'dengue', 'kidney', 'immunization', 'breastfeeding', 'lung', 'sight', 'mental', 'malaria', 'aids',
    'tobacco', 'drug abuse', 'suicide',
  ]],
  ['nature-safety', [
    'food conservation', 'zero waste', 'fire prevention', 'earth day', 'environment', 'disaster',
    'resilience', 'coastal', 'maritime', 'climate', 'global warming', 'tsunami', 'road crash',
    'safe kids', 'watch month',
  ]],
  ['learning-culture', [
    'arts', 'wika', 'musikang', 'music', 'literacy', 'teachers', 'education', 'students', 'pagbasa',
    'reading', 'science', 'tech-voc', 'scouting', 'gifted', 'talented', 'intellectual property',
    'indigenous peoples', 'kasoutang', 'kasuotang',
  ]],
  ['community-rights', [
    'human rights', 'women', 'girl child', 'children', 'child ', 'family', 'youth', 'peace',
    'disability', 'elderly', 'deaf', 'violence', 'justice', 'values', 'adoption', 'hijab',
    'sexual abuse', 'adhd', 'international day of persons',
  ]],
  ['innovation-civic', [
    'internet', 'information', 'ict', 'innovation', 'consumer', 'financial', 'economic',
    'united nations', 'asean', 'world humanitarian',
  ]],
]

/**
 * Picks a quiet, celebration-relevant illustration family for a permanent Annex D event.
 * The artwork stays decorative; the event title and source label remain the source of truth.
 */
export function legislatedActivityIllustration(title: string): LegislatedActivityIllustration {
  const normalizedTitle = title.toLocaleLowerCase('en-US')
  for (const [illustration, keywords] of themedKeywords) {
    if (keywords.some((keyword) => normalizedTitle.includes(keyword))) return illustration
  }
  return 'heritage-commemoration'
}
