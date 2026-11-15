export const RESUME_UPDATE_INTERVAL = 30 * 60_000
export const OPEN_UPDATE_INTERVAL = 60 * 60_000
export const SEEN_BUILD_KEY = 'kanso-pro:seen-build:v1'
export const DISMISSED_UPDATE_KEY = 'kanso-pro:dismissed-update:v1'
export function updateSurface(overlay: boolean, coarse: boolean, signedIn: boolean) {
  return overlay ? 'titlebar' : coarse && !signedIn ? 'toast' : 'banner'
}
export function shouldCheckOnResume(last: number, now: number) { return now - last >= RESUME_UPDATE_INTERVAL }
export function isNewBuild(previous: string | null, current: string) { return !!previous && previous !== current }
export function currentBuild() {
  return document.querySelector<HTMLMetaElement>('meta[name="app-version"]')?.content ?? 'development'
}
