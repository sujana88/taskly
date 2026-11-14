import { describe, expect, it } from 'vitest'
import { CLIENT_COLORS } from '../features/clients/actions'
import { contrastOnWhite, inkOn, textShade } from './color'

describe('client colours', () => {
  it('keeps dark colours as they are and darkens light ones for text', () => {
    expect(textShade('#0E7490')).toBe('#0e7490')
    expect(contrastOnWhite(textShade('#EAB308'))).toBeGreaterThanOrEqual(4.5)
    for (const c of CLIENT_COLORS) expect(contrastOnWhite(textShade(c))).toBeGreaterThanOrEqual(4.5)
  })

  it('picks dark letters on yellow and white letters on dark colours', () => {
    expect(inkOn('#EAB308')).toBe('#1f2937')
    expect(inkOn('#0E7490')).toBe('#ffffff')
  })
})
