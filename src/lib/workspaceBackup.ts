import type { JourneyState } from '../types'

export const BACKUP_READY = 'Your device workspace backup is ready. Check your downloads and keep the file somewhere private.'
export const BACKUP_FAILED = 'We could not download the backup in this browser. Your workspace is unchanged.'

/** Explicitly export journey data, never an account/session object or extra root metadata. */
export function buildWorkspaceBackup(state: JourneyState, now = new Date()) {
  return {
    fileName: `kanso-pro-journey-${now.toISOString().slice(0, 10)}.json`,
    json: JSON.stringify({ version: state.version, cards: state.cards, bezel: state.bezel }, null, 2),
  }
}

/** Starts a local download; it cannot verify where the browser/user saves the file. */
export function downloadWorkspaceBackup(state: JourneyState) {
  const { fileName, json } = buildWorkspaceBackup(state)
  const link = document.createElement('a')
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  try {
    link.href = url
    link.download = fileName
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    // Let the browser consume the object URL before releasing it, including on failure.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
