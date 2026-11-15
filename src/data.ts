import type { JourneyCard, JourneyState } from './types'

// The supplied journey is a November 2026 example. Keep its focus date stable.
export const FOCUS_DATE = '2026-11-14'
export const STORAGE_KEY = 'kanso-pro:journey:v1'
export const LEGACY_STORAGE_KEY = 'chronos-flow:journey:v1'

const seedCards: JourneyCard[] = [
  {
    id: 'evt-holiday',
    type: 'event',
    title: "All Souls’ Day (Additional Special Non-Working Holiday)",
    date: '2026-11-02',
    side: 'left',
    context: 'Imported from the 2026–2027 school activities calendar',
    allDay: true,
    holiday: true,
    owner: 'You',
    organization: 'PH Holiday',
    location: 'Philippines',
  },
  {
    id: 'note-lesson',
    type: 'note',
    title: 'Q2 Reading Comprehension Rubric Ideas',
    date: '2026-11-06',
    side: 'right',
    context: 'A few ideas for the next reading block',
    quiet: true,
    body: 'Make room for different ways of showing understanding. Try a simple four-part rubric: identify the main idea, find supporting evidence, make an inference, and connect the text to a personal experience.\n\nFor next week: prepare a short sample response for each level and invite students to help describe what a thoughtful answer looks like.',
    tags: ['Reading', 'LessonPlanning'],
    pinned: false,
    time: '16:00',
  },
  {
    id: 'task-prep',
    type: 'task',
    title: 'Weekly Classroom Supply Inventory',
    date: '2026-11-08',
    side: 'left',
    context: 'A small reset before a new school week',
    quiet: true,
    reminder: '15:00',
    subtasks: [
      { id: 'prep-1', title: 'Check classroom supplies and note what needs restocking', done: false },
    ],
  },
  {
    id: 'evt-oquendo',
    type: 'event',
    title: 'Faculty Alignment & Curriculum Sync',
    date: '2026-11-10',
    side: 'left',
    context: 'Align on the quarter ahead and share classroom priorities.',
    allDay: false,
    holiday: false,
    time: '09:00',
    endTime: '10:30',
    owner: 'Floyran Gumban',
    organization: 'Oquendo ES v2',
    location: 'Conference Room B',
  },
  {
    id: 'task-grades',
    type: 'task',
    title: 'Finalize Advisory Class Record & Parent Slips',
    date: '2026-11-11',
    side: 'left',
    context: 'Advisory reminders',
    reminder: '14:30',
    subtasks: [
      { id: 'grades-1', title: 'Export Q1 attendance sheet', done: true, label: 'High priority' },
      { id: 'grades-2', title: 'Send reminder SMS to 4 parents', done: false, label: 'Due 2:30 PM' },
    ],
  },
  {
    id: 'note-observation',
    type: 'note',
    title: 'Classroom Observation Reflections & Peer Feedback',
    date: '2026-11-11',
    side: 'right',
    context: 'A moment to reflect on what worked',
    body: '“Students responded exceptionally well to the collaborative group stations during the science inquiry block. Note for next week: extend the synthesis timer by 10 mins and prepare printed visual anchor charts for Station 3.”',
    tags: ['Pedagogy', 'Reflection'],
    pinned: true,
    time: '16:15',
  },
  {
    id: 'proj-tos',
    type: 'project',
    title: 'Quarterly Assessment Test & Table of Specifications (TOS)',
    date: '2026-11-12',
    side: 'right',
    context: 'Curriculum Planning Group',
    dueDate: '2026-11-14',
    team: ['Floyran Gumban', 'J. Santos', 'Grade Level Chair', 'Oquendo ES Office'],
    featured: true,
    subtasks: [
      { id: 'tos-1', title: 'Map learning competencies to cognitive domains (Bloom’s Taxonomy)', done: true, assignee: 'J. Santos', label: 'TOS Matrix' },
      { id: 'tos-2', title: 'Draft 40-item multiple choice questionnaire & answer key', done: false, assignee: 'Floyran Gumban', label: 'Test Draft' },
      { id: 'tos-3', title: 'Peer validation & item difficulty calibration', done: false, assignee: 'Grade Level Chair', label: 'QA Review' },
      { id: 'tos-4', title: 'Principal sign-off & master print reproduction', done: false, assignee: 'Oquendo ES Office', label: 'Final Sign-off' },
    ],
  },
  {
    id: 'proj-reading',
    type: 'project',
    title: 'School-Wide Reading Festival & Literacy Booths',
    date: '2026-11-13',
    side: 'left',
    context: 'Stage Design & Book Drive',
    dueDate: '2026-11-20',
    team: ['Floyran Gumban', 'J. Santos', 'Ana Reyes', 'Marco Cruz', 'L. Garcia', 'P. Dela Cruz'],
    subtasks: [
      { id: 'reading-1', title: 'Agree on the festival theme and reading goals', done: true, assignee: 'Planning Team' },
      { id: 'reading-2', title: 'Confirm grade-level booth coordinators', done: true, assignee: 'J. Santos' },
      { id: 'reading-3', title: 'Publish the book donation wish list', done: true, assignee: 'Ana Reyes' },
      { id: 'reading-4', title: 'Prepare stage design and signage', done: true, assignee: 'Marco Cruz' },
      { id: 'reading-5', title: 'Collect volunteer schedules', done: true, assignee: 'L. Garcia' },
      { id: 'reading-6', title: 'Finalize reading station materials', done: true, assignee: 'P. Dela Cruz' },
      { id: 'reading-7', title: 'Set up literacy booths and test the sound system', done: false, assignee: 'Planning Team' },
      { id: 'reading-8', title: 'Share the final festival programme with families', done: false, assignee: 'Floyran Gumban' },
    ],
  },
]

export function createInitialState(): JourneyState {
  return { version: 1, cards: structuredClone(seedCards), bezel: false }
}
