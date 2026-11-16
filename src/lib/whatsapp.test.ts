import { describe, expect, it } from 'vitest'
import type { Invoice } from '../db/types'
import { imageMessage, invoiceMessage, waLink, waNumber } from './whatsapp'

const invoice: Invoice = {
  id: 'i1', clientId: 'c1', number: 'INV-2026-001', status: 'draft', issueDate: '2026-11-12', dueDate: '2026-11-26', currency: 'EUR',
  billToName: 'Nordlicht Studio', billToDetails: '', items: [{ id: 'a', description: 'Hero section redesign', quantity: 4.17, unitPrice: 45 }, { id: 'b', description: '', quantity: 1, unitPrice: 0 }],
  discount: 10, taxName: 'USt', taxRate: 19, taxKind: 'add', notes: '', periodStart: '2026-11-01', periodEnd: '2026-11-12', createdAt: '2026-11-12T00:00:00Z',
}
const sender = { name: 'Demo Freelancer', company: 'Demo Design Studio', phone: '+62 812 3456 7890' }

describe('WhatsApp numbers', () => {
  it('turns stored numbers into wa.me digits', () => {
    expect(waNumber('+62 812-3456-7890')).toBe('6281234567890')
    expect(waNumber('+49 (151) 2345 678')).toBe('491512345678')
    expect(waNumber('0049 151 2345678')).toBe('491512345678')
    expect(waNumber('0812 3456 7890', 'ID')).toBe('6281234567890')
    expect(waNumber('0812 3456 7890')).toBeUndefined()
    expect(waNumber('+62 12')).toBeUndefined()
    expect(waNumber('')).toBeUndefined()
  })

  it('builds a wa.me link with the text encoded', () => {
    expect(waLink('62812', 'Hi & thanks\n*bold*')).toBe('https://wa.me/62812?text=Hi%20%26%20thanks%0A*bold*')
  })
})

describe('invoice message', () => {
  it('is polite and complete in English', () => {
    const m = invoiceMessage({ invoice, contact: 'Lena', sender, paymentDetails: 'IBAN DE00 1234' }, 'en')
    expect(m).toContain('Hello Lena,')
    expect(m).toContain('details of invoice *INV-2026-001* from Demo Design Studio.')
    expect(m).toContain('Due date: 26 Nov 2026')
    expect(m).toContain('Period: 1 Nov 2026 – 12 Nov 2026')
    expect(m).toContain('• Hero section redesign\n   4,17 × € 45 = € 187,65')
    expect(m).not.toContain('• —')
    expect(m).toContain('Discount: − € 10')
    expect(m).toContain('USt 19%: € 33,75')
    expect(m).toContain('*Total due: € 211,40*')
    expect(m).toContain('Kindly arrange the payment by *26 Nov 2026* to:\nIBAN DE00 1234')
    expect(m.endsWith('Kind regards,\nDemo Freelancer\nDemo Design Studio\n+62 812 3456 7890')).toBe(true)
  })

  it('reads naturally in Indonesian, and handles withheld tax', () => {
    const m = invoiceMessage({ invoice: { ...invoice, currency: 'IDR', items: [{ id: 'a', description: 'Desain', quantity: 10, unitPrice: 250000 }], discount: 0, taxName: 'PPh 23', taxRate: 2, taxKind: 'withhold' }, sender }, 'id')
    expect(m).toContain('Halo Nordlicht Studio,')
    expect(m).toContain('Semoga Anda dalam keadaan baik.')
    expect(m).toContain('PPh 23 2% (dipotong): − Rp 50.000,-')
    expect(m).toContain('*Total tagihan: Rp 2.450.000,-*')
    expect(m).toContain('Mohon pembayaran dapat dilakukan paling lambat *26 Nov 2026*.')
    expect(m).toContain('Salam hangat,')
  })

  it('has a short version to go with the image', () => {
    expect(imageMessage({ invoice, contact: 'Lena', sender }, 'en')).toMatch(/^Hello Lena, please find attached invoice \*INV-2026-001\* for \*€ 211,40\*, due on \*26 Nov 2026\*\./)
  })
})
