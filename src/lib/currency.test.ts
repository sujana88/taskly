import { describe, expect, it } from 'vitest'
import { currencyLabel, formatMoney } from './currency'

describe('money display', () => {
  it('puts letters in front of every dollar sign', () => {
    expect(formatMoney(60, 'USD', 'en')).toBe('US $ 60')
    expect(formatMoney(70, 'AUD', 'en')).toBe('A $ 70')
    expect(formatMoney(55, 'NZD', 'en')).toBe('N $ 55')
    expect(formatMoney(80, 'CAD', 'en')).toBe('C $ 80')
    expect(formatMoney(90, 'SGD', 'en')).toBe('S $ 90')
  })

  it('uses a comma for decimals and a dot for thousands, in every language', () => {
    expect(formatMoney(534.48, 'USD', 'en')).toBe('US $ 534,48')
    expect(formatMoney(510.09, 'AUD', 'id')).toBe('A $ 510,09')
    expect(formatMoney(1234.5, 'USD', 'en')).toBe('US $ 1.234,50')
    expect(formatMoney(416.25, 'EUR', 'en')).toBe('€ 416,25')
    expect(formatMoney(8000, 'JPY', 'en')).toBe('¥ 8.000')
    expect(formatMoney(50, 'MYR', 'en')).toBe('RM 50')
    expect(formatMoney(30, 'CHF', 'en')).toBe('CHF 30')
    expect(formatMoney(12, 'XYZ', 'en')).toBe('XYZ 12')
  })

  it('writes Rupiah without cents and ending in ",-"', () => {
    expect(formatMoney(834123.4, 'IDR', 'en')).toBe('Rp 834.123,-')
    expect(formatMoney(250000, 'IDR', 'id')).toBe('Rp 250.000,-')
    expect(formatMoney(666666.67, 'IDR', 'en')).toBe('Rp 666.667,-')
  })

  it('labels the currency picker with code and sign', () => {
    expect(currencyLabel('IDR')).toBe('IDR · Rp')
    expect(currencyLabel('USD')).toBe('USD · US $')
    expect(currencyLabel('CHF')).toBe('CHF')
  })
})
