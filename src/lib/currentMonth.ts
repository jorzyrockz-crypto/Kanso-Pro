/** The sign-in scene follows the device's real local month, not the sample journey. */
export function currentLocalMonth(now = new Date()): string {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Reschedule at local midnight (including DST), safely below the browser timeout cap. */
export function nextLocalDayDelay(now = new Date()): number {
  const tomorrow = new Date(now)
  tomorrow.setHours(24, 0, 0, 0)
  return Math.max(100, tomorrow.getTime() - now.getTime() + 50)
}
