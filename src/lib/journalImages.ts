const MAX_INPUT_BYTES = 10 * 1024 * 1024
const TARGET_BYTES = 600 * 1024
const MAX_DIMENSION = 2048
const MIN_DIMENSION = 640

export class JournalImageError extends Error {}

type UploadError = { code?: unknown; message?: unknown }

/** Turns browser/Firebase write failures into recovery steps a person can act on. */
export function journalImageUploadErrorMessage(error: unknown) {
  if (error instanceof JournalImageError) return error.message
  const detail = error && typeof error === 'object' ? error as UploadError : {}
  const code = typeof detail.code === 'string' ? detail.code.replace(/^firestore\//, '') : ''
  const message = typeof detail.message === 'string' ? detail.message : ''
  if (message.includes('This image is too large for private Firestore storage.')) return 'This photo is still too large after preparation. Choose a smaller or simpler image.'
  if (code === 'permission-denied') return 'Firestore could not save this photo because this Google account does not have access. Reconnect Google or ask a Space Owner for Editor access.'
  if (code === 'unauthenticated') return 'Your Google session expired. Sign in with Google again, then retry the photo.'
  if (['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code)) return 'Firestore cannot be reached right now. Check your connection, then retry the photo.'
  if (code === 'resource-exhausted') return 'Firestore cannot save this photo right now because its upload limit was reached. Choose a smaller image and retry.'
  return 'The photo was not saved. Check your connection and Google sign-in, then retry.'
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new JournalImageError('This image could not be read.')) }
    image.src = url
  })
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new JournalImageError('This image could not be prepared for upload.')), 'image/webp', quality))
}

/**
 * Preserves visual detail with high-quality canvas resampling, then adaptively reduces
 * dimensions/quality only until its Firestore-safe payload budget is met.
 */
export async function optimizeJournalImage(file: File) {
  if (!file.type.startsWith('image/')) throw new JournalImageError('Choose an image file.')
  if (file.size > MAX_INPUT_BYTES) throw new JournalImageError('Choose an image smaller than 10 MB.')
  const image = await loadImage(file)
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new JournalImageError('Choose an image with fewer than 40 million pixels.')

  const ratio = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight))
  let width = Math.max(1, Math.round(image.naturalWidth * ratio))
  let height = Math.max(1, Math.round(image.naturalHeight * ratio))
  let quality = .92

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new JournalImageError('This browser cannot prepare images for upload.')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, width, height)
    const blob = await canvasBlob(canvas, quality)
    if (blob.size <= TARGET_BYTES) return { blob, width, height }
    if (quality > .82) quality = Math.max(.82, quality - .04)
    else {
      const scale = Math.max(.72, Math.sqrt(TARGET_BYTES / blob.size) * .94)
      const nextWidth = Math.max(MIN_DIMENSION, Math.round(width * scale))
      const nextHeight = Math.max(MIN_DIMENSION, Math.round(height * scale))
      if (nextWidth === width && nextHeight === height) break
      width = nextWidth
      height = nextHeight
      quality = .9
    }
  }
  throw new JournalImageError('This image could not be reduced enough for private Firestore storage. Try a simpler or smaller image.')
}

export function blobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new JournalImageError('This image could not be prepared for upload.'))
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new JournalImageError('This image could not be prepared for upload.'))
    reader.readAsDataURL(blob)
  })
}
