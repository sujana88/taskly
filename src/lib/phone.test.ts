import { describe, expect, it } from 'vitest'
import { countryForZone, countryOptions, joinPhone, splitPhone } from './phone'

describe('phone numbers', () => {
  it('suggests a country from the time zone', () => {
    expect(countryForZone('Asia/Jakarta')).toBe('ID')
    expect(countryForZone('Australia/Sydney')).toBe('AU')
    expect(countryForZone('America/New_York')).toBe('US')
    expect(countryForZone('America/Toronto')).toBe('CA')
    expect(countryForZone('Antarctica/Troll', 'SG')).toBe('SG')
  })

  it('joins code and local number, dropping the trunk 0', () => {
    expect(joinPhone('ID', '0812 3456 7890')).toBe('+62 812 3456 7890')
    expect(joinPhone('JP', '3-1234-5678')).toBe('+81 3-1234-5678')
    expect(joinPhone('IT', '06 1234 5678')).toBe('+39 06 1234 5678')
    expect(joinPhone('ID', '   ')).toBe('')
    expect(joinPhone('ID', '+44 20 7946 0000')).toBe('+44 20 7946 0000')
  })

  it('splits a stored number back into country and local part', () => {
    expect(splitPhone('+62 812 3456 7890', 'US')).toEqual({ country: 'ID', local: '812 3456 7890' })
    expect(splitPhone('+81 3-1234-5678', 'ID')).toEqual({ country: 'JP', local: '3-1234-5678' })
    expect(splitPhone('+6281234567', 'ID')).toEqual({ country: 'ID', local: '81234567' })
    // +1 is shared: the client's zone decides.
    expect(splitPhone('+1 416 555 0100', 'CA')).toEqual({ country: 'CA', local: '416 555 0100' })
    expect(splitPhone('+1 212 555 0100', 'ID').country).toBe('US')
    // Longest code wins (+852 Hong Kong, not +85…).
    expect(splitPhone('+852 2123 4567', 'ID')).toEqual({ country: 'HK', local: '2123 4567' })
    expect(splitPhone('0812 3456', 'ID')).toEqual({ country: 'ID', local: '0812 3456' })
    expect(splitPhone(undefined, 'ID')).toEqual({ country: 'ID', local: '' })
  })

  it('lists countries by name in the interface language', () => {
    const en = countryOptions('en')
    expect(en.find((c) => c.iso === 'DE')).toMatchObject({ name: 'Germany', dial: '+49' })
    expect(countryOptions('id').find((c) => c.iso === 'DE')?.name).toBe('Jerman')
  })
})
