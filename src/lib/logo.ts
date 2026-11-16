/**
 * Turns an uploaded image into a small data URL for the invoice header: at most 640×240 px,
 * PNG (keeps transparency), falling back to WebP/JPEG if the PNG is still too big.
 */
export const MAX_LOGO_BYTES = 5 * 1024 * 1024
/** Fits the profiles.company_logo check (400 000 characters) with room to spare. */
export const MAX_LOGO_CHARS = 380_000
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
export const LOGO_ACCEPT = ACCEPTED.join(',')

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('not an image'))
    img.src = src
  })
}

/** Throws when the file is not a usable image. */
export async function prepareLogo(file: File, maxW = 640, maxH = 240): Promise<string> {
  if (!ACCEPTED.includes(file.type) || file.size > MAX_LOGO_BYTES) throw new Error('unsupported')
  const img = await loadImage(await readAsDataUrl(file))
  const w0 = img.naturalWidth || img.width || maxW
  const h0 = img.naturalHeight || img.height || maxH
  const scale = Math.min(1, maxW / w0, maxH / h0)
  const w = Math.max(1, Math.round(w0 * scale))
  const h = Math.max(1, Math.round(h0 * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.drawImage(img, 0, 0, w, h)
  for (const [type, q] of [['image/png', undefined], ['image/webp', 0.9], ['image/jpeg', 0.85]] as const) {
    const url = canvas.toDataURL(type, q)
    if (url.startsWith(`data:${type}`) && url.length <= MAX_LOGO_CHARS) return url
  }
  throw new Error('too big')
}
