/** Small helpers so any client colour stays readable, including light ones like yellow. */

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6)
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

const toHex = (c: [number, number, number]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

/** Contrast ratio of a colour against white. */
export function contrastOnWhite(hex: string): number {
  return 1.05 / (luminance(rgb(hex)) + 0.05)
}

/** The colour itself when it reads well as text on white; otherwise a darker shade of it (4.5:1). */
export function textShade(hex: string): string {
  let c = rgb(hex)
  for (let i = 0; i < 20 && 1.05 / (luminance(c) + 0.05) < 4.5; i++) c = c.map((v) => v * 0.88) as [number, number, number]
  return toHex(c)
}

/** White or near-black lettering, whichever reads better on this colour. */
export function inkOn(hex: string): string {
  return luminance(rgb(hex)) > 0.4 ? '#1f2937' : '#ffffff'
}
