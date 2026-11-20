import { describe, expect, it } from 'vitest'
import { DEFAULT_RATES, cleanRates, convertAmount, convertInvoice, rateBetween, rateText, ratesOf } from './fx'

const rates = { USD: 1, IDR: 18263, CAD: 1.4307, AUD: 1.5002, EUR: 0.90992, JPY: 158.64 }

describe('exchange rates', () => {
  it('converts through the dollar, rounded the way each currency is written', () => {
    expect(convertAmount(30, 'USD', 'IDR', rates)).toBe(547890)
    expect(convertAmount(500, 'USD', 'CAD', rates)).toBe(715.35)
    expect(convertAmount(547890, 'IDR', 'USD', rates)).toBe(30)
    expect(convertAmount(100, 'AUD', 'IDR', rates)).toBe(1217371)
    expect(convertAmount(10, 'EUR', 'JPY', rates)).toBe(1743)
    expect(convertAmount(10, 'USD', 'XYZ', rates)).toBeUndefined()
    expect(rateBetween('IDR', 'IDR', {})).toBe(1)
  })

  it('converts every price and the discount of an invoice', () => {
    const inv = { currency: 'USD', discount: 10, items: [{ id: 'a', description: 'Design', quantity: 2, unitPrice: 30 }, { id: 'b', description: 'Logo', quantity: 1, unitPrice: 500 }] }
    const idr = convertInvoice(inv, 'IDR', rates)
    expect(idr).toMatchObject({ currency: 'IDR', discount: 182630, converted: true })
    expect(idr.items.map((x) => x.unitPrice)).toEqual([547890, 9131500])
    expect(idr.items[0].quantity).toBe(2)
    // No rate: only the currency changes.
    expect(convertInvoice(inv, 'XYZ', rates)).toMatchObject({ currency: 'XYZ', converted: false, discount: 10 })
  })

  it('reads saved rates on top of the defaults and keeps the dollar at 1', () => {
    expect(ratesOf(undefined)).toEqual(DEFAULT_RATES)
    const r = ratesOf({ exchangeRates: { date: '2026-12-01', rates: { IDR: 17000, CAD: 0, USD: 3 } } })
    expect(r.date).toBe('2026-12-01')
    expect(r.rates).toMatchObject({ IDR: 17000, CAD: DEFAULT_RATES.rates.CAD, USD: 1 })
    expect(cleanRates({ IDR: 18263.1234567, AUD: -1, USD: 5 })).toEqual({ USD: 1, IDR: 18263.123457 })
  })

  it('says a rate the bigger way round', () => {
    expect(rateText('USD', 'IDR', rates)).toBe('1 US $ = Rp 18.263')
    expect(rateText('IDR', 'USD', rates)).toBe('1 US $ = Rp 18.263')
    expect(rateText('USD', 'CAD', rates)).toBe('1 US $ = CA $ 1,4307')
  })
})
