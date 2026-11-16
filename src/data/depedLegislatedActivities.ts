import type { CalendarRecurringRule } from '../lib/calendarSources'

const monthly = (id: string, title: string, month: number): CalendarRecurringRule => ({ id, title, month, kind: 'month' })
const on = (id: string, title: string, month: number, day: number): CalendarRecurringRule => ({ id, title, month, day, kind: 'date' })
const span = (id: string, title: string, month: number, startDay: number, endDay: number): CalendarRecurringRule => ({ id, title, month, startDay, endDay, kind: 'range' })
const week = (id: string, title: string, month: number, value: 1 | 2 | 3 | 4 | 'last'): CalendarRecurringRule => ({ id, title, month, week: value, kind: 'week' })
const nthWeekday = (id: string, title: string, month: number, nth: 1 | 2 | 3 | 4 | 5, weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6): CalendarRecurringRule => ({ id, title, month, nth, weekday, kind: 'nth-weekday' })
const containingWeek = (id: string, title: string, month: number, day: number): CalendarRecurringRule => ({ id, title, month, day, kind: 'week-containing' })
const crossMonth = (id: string, title: string, startMonth: number, startDay: number, endMonth: number, endDay: number): CalendarRecurringRule => ({ id, title, startMonth, startDay, endMonth, endDay, kind: 'cross-month-range' })

/**
 * Permanent annual recurrence rules transcribed and verified from DepEd Order No. 009,
 * s. 2026, Annex D, printed pages 29–55. The source keeps its recurrence expressions
 * rather than baking a single school year's dates into personal cards.
 */
export const DEPED_LEGISLATED_ACTIVITY_RULES: CalendarRecurringRule[] = [
  // January
  monthly('food-conservation', 'Food Conservation Month', 1),
  monthly('zero-waste', 'Zero Waste Month', 1),
  monthly('firecracker-injury-january', 'Firecrackers Injury Prevention Month', 1),
  span('human-rights-january', 'National Human Rights Consciousness Week', 1, 4, 10),
  week('cancer-consciousness', 'National Cancer Consciousness Week', 1, 3),
  week('autism-consciousness', 'National Autism Consciousness Week', 1, 3),
  on('first-republic', 'Commemoration of the First Philippine Republic Day', 1, 23),

  // February
  monthly('down-syndrome', 'National Down Syndrome Awareness Month', 2),
  monthly('arts', 'National Arts Month', 2),
  on('hijab', 'National Hijab Day', 2, 1),
  span('dental-health', 'National Dental Health Month', 2, 1, 28),
  span('heart-month', 'Philippine Heart Month', 2, 1, 28),
  nthWeekday('adoption-day', 'Adoption Consciousness Day', 2, 1, 6),
  on('women-girls-science', 'International Day of Women and Girls in Science', 2, 11),
  nthWeekday('safer-internet', 'Safer Internet Day for Children Philippines', 2, 2, 2),
  week('child-sexual-abuse-prevention', 'National Awareness Week for the Prevention of Child Sexual Abuse and Exploitation', 2, 2),
  week('intellectual-disability', 'Intellectual Disability Awareness Week', 2, 2),
  span('edsa', 'EDSA People Power Commemoration Week', 2, 22, 25),
  week('leprosy-control', 'Leprosy Control Week', 2, 'last'),

  // March
  monthly('fire-prevention', 'Fire Prevention Month', 3),
  monthly('womens-history', 'Women’s Role in History Month', 3),
  week('womens-week', 'Women’s Week', 3, 1),
  on('international-womens-day', 'International Women’s Day', 3, 8),
  week('gender-fair-girl-child', 'Protection and Gender-Fair Treatment of the Girl Child Week', 3, 4),

  // April
  monthly('intellectual-property', 'National Intellectual Property Month', 4),
  on('francisco-baltazar', 'Commemoration of the Birth Anniversary of Francisco “Balagtas” Baltazar', 4, 2),
  on('araw-ng-kagitingan', 'Commemoration of the Araw ng Kagitingan', 4, 9),
  on('innovation-day', 'Philippine Innovation Day', 4, 21),
  on('girls-ict', 'International Girls in ICT Day', 4, 28),

  // May
  on('health-workers', 'Health Workers’ Day', 5, 7),
  on('information-society', 'World Information Society Day', 5, 17),
  on('australia-friendship', 'Commemoration of the Philippine-Australia Friendship Day', 5, 22),
  on('earth-day', 'Philippines’ Earth Day', 5, 22),
  crossMonth('display-national-flag', 'Display of the National Flag', 5, 28, 6, 12),
  on('flag-day', 'Flag Day', 5, 28),
  on('no-tobacco', 'World No Tobacco Day', 5, 31),

  // June
  monthly('dengue', 'National Dengue Awareness Month', 6),
  monthly('kidney', 'National Kidney Month', 6),
  monthly('watch', 'W.A.T.C.H. Month', 6),
  monthly('environment', 'Philippine Environment Month', 6),
  monthly('ict', 'National Information and Communications Technology Month', 6),
  on('world-environment', 'World Environment Day', 6, 5),
  week('safe-kids', 'National Safe Kids Week', 6, 3),
  on('deped-founding', 'Department of Education Founding Anniversary', 6, 23),
  on('drug-abuse', 'International Day Against Drug Abuse and Illicit Trafficking', 6, 26),
  on('baler-friendship', 'Commemoration of the Historic Siege of Baler and Philippine-Spanish Friendship Day', 6, 30),

  // July
  monthly('disaster-resilience', 'National Disaster Resilience Month', 7),
  monthly('nutrition', 'Nutrition Month', 7),
  week('disability-prevention', 'National Disability Prevention and Rehabilitation Week', 7, 3),
  week('musikang-pilipino', 'Linggo ng Musikang Pilipino', 7, 'last'),

  // August
  on('white-cane', 'White Cane Safety Day', 8, 1),
  monthly('wika', 'Buwan ng Wikang Pambansa', 8),
  monthly('asean', 'ASEAN Month', 8),
  monthly('adolescent-immunization', 'National Adolescent Immunization Month', 8),
  monthly('breastfeeding', 'Breastfeeding Awareness Month', 8),
  monthly('lung', 'National Lung Month', 8),
  monthly('sight-saving', 'Sight Saving Month', 8),
  monthly('history', 'History Month', 8),
  week('sight-conservation', 'Sight-Conservation Week', 8, 1),
  on('indigenous-peoples', 'National Indigenous Peoples Day', 8, 9),
  on('international-youth', 'Philippine International Youth Day', 8, 12),
  containingWeek('linggo-kabataan', 'Linggo ng Kabataan', 8, 12),
  on('quezon', 'Commemoration of the Birth Anniversary of President Manuel L. Quezon', 8, 19),
  on('humanitarian', 'World Humanitarian Day', 8, 19),
  on('tech-voc', 'National Tech-Voc Day', 8, 25),

  // September
  monthly('peace-consciousness', 'National Peace Consciousness Month', 9),
  week('maritime-awareness', 'Maritime and Archipelagic Nation Awareness Month', 9, 1),
  span('crime-prevention', 'National Crime Prevention Week', 9, 2, 8),
  on('literacy-week', 'Literacy Week Celebration', 9, 8),
  on('literacy-day', 'International Literacy Day / National Literacy Day', 9, 8),
  crossMonth('teachers-month', 'National Teachers’ Month', 9, 5, 10, 5),
  on('suicide-prevention', 'World Suicide Prevention Day', 9, 10),
  on('international-peace', 'International Day of Peace in the Philippines', 9, 21),
  nthWeekday('coastal-cleanup', 'International Coastal Clean-up Day', 9, 3, 6),
  week('kasuotang-pilipino', 'Linggo ng Kasuotang Pilipino', 9, 3),
  nthWeekday('salu-salo', 'Salu-salo ng Pamilya', 9, 4, 1),
  week('family-week', 'Family Week', 9, 'last'),

  // October
  monthly('consumer-welfare', 'Consumer Welfare Month', 10),
  monthly('indigenous-peoples-month', 'National Indigenous Peoples Month', 10),
  monthly('scouting', 'National Scouting Month', 10),
  week('elderly-filipino', 'Linggo ng Katandaang Filipino (Elderly Filipino Week)', 10, 1),
  on('world-teachers', 'World Teachers’ Day', 10, 5),
  on('national-teachers', 'National Teachers’ Day', 10, 5),
  week('mental-health', 'National Mental Health Week', 10, 2),
  on('disaster-risk-reduction', 'International Day of Disaster Risk Reduction', 10, 13),
  span('un-week', 'United Nations Week', 10, 18, 24),
  week('adhd', 'ADHD Awareness Week', 10, 3),
  week('juvenile-justice', 'Juvenile Justice and Welfare Consciousness Week', 10, 4),

  // November
  monthly('filipino-values', 'Filipino Values Month', 11),
  monthly('malaria', 'Malaria Awareness Month', 11),
  monthly('childrens-month', 'National Children’s Month', 11),
  monthly('environment-awareness', 'National Environment Awareness Month', 11),
  monthly('library-services', 'Library and Information Services Month', 11),
  span('deaf-awareness', 'Deaf Awareness Week', 11, 10, 16),
  on('tsunami', 'World Tsunami Awareness Day', 11, 5),
  on('sheikh-karimul', 'Sheikh Karim ul Makhdum Day', 11, 7),
  week('financial-literacy', 'Economic and Financial Literacy Week', 11, 2),
  on('students-day', 'National Students’ Day', 11, 17),
  span('global-warming', 'Global Warming and Climate Change Consciousness Week', 11, 19, 25),
  nthWeekday('road-crash-victims', 'National Day of Remembrance for Road Crash Victims, Survivors, and their Families', 11, 3, 0),
  on('violence-against-women', 'National Consciousness Day for the Elimination of Violence Against Women and Children', 11, 25),
  on('youth-climate', 'National Day for Youth in Climate Action', 11, 25),
  crossMonth('end-violence-against-women', '18-day Campaign to End Violence Against Women', 11, 25, 12, 12),
  on('araw-ng-pagbasa', 'Araw ng Pagbasa', 11, 27),
  week('gifted-talented', 'Week of the Gifted and Talented', 11, 4),
  week('science-technology', 'National Science and Technology Week', 11, 4),
  week('music-young-artists', 'National Music Week for Young Artists', 11, 'last'),

  // December
  on('aids', 'World AIDS Day', 12, 1),
  on('persons-disabilities', 'International Day of Persons with Disabilities in the Philippines', 12, 3),
  monthly('firecracker-injury-december', 'Firecrackers Injury Prevention Month', 12),
  span('human-rights-december', 'National Human Rights Consciousness Week', 12, 4, 10),
  nthWeekday('childrens-broadcasting', 'National Children’s Day of Broadcasting', 12, 2, 0),
  week('education-week', 'Education Week', 12, 2),
]
