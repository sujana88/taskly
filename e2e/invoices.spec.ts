import { expect, test, type Page } from '@playwright/test'
import { signInAsDemo, startClockAt } from './helpers'

const shots = 'e2e-screenshots'

test.beforeEach(async ({ page }) => {
  // Thursday 12 Nov 2026, 16:02 in Jakarta.
  await startClockAt(page, '2026-11-12T09:02:00Z')
  await signInAsDemo(page)
})

async function setUpTaxes(page: Page) {
  await page.goto('/#/settings')
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
  await expect(page.getByText('No tax rates yet.')).toBeVisible()
  await page.getByRole('button', { name: /Germany · USt 19%/ }).click()
  await page.getByRole('button', { name: /Indonesia · PPN 11%/ }).click()
  await expect(page.getByTestId('tax-row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Save tax rates' }).click()
  await expect(page.getByText('Saved')).toBeVisible()
}

async function setUpBusiness(page: Page) {
  await page.goto('/#/profile')
  const form = page.getByTestId('business-form')
  await form.getByLabel('Company name').fill('Demo Design Studio')
  await form.getByLabel('Address').fill('Jl. Kemang Raya 12\nJakarta 12730, Indonesia')
  await form.getByLabel('Billing email').fill('billing@demo.example')
  await form.getByLabel('Tax ID (NPWP, VAT, ABN…)').fill('01.234.567.8-901.000')
  await form.getByTestId('logo-input').setInputFiles('public/favicon.svg')
  await expect(form.getByTestId('logo-preview').locator('img')).toHaveAttribute('src', /^data:image\/png;base64,/)
  await form.getByRole('button', { name: 'Save business details' }).click()
  await expect(form.getByText('Saved')).toBeVisible()
}

test('settings: tax rates per country and invoice defaults are saved', async ({ page }) => {
  await setUpTaxes(page)
  await page.getByLabel('Payment terms (days)').fill('30')
  await page.getByLabel('Payment details').fill('Bank BCA 123 456 7890 a.n. Demo Freelancer')
  await expect(page.getByText('Invoice numbers look like INV-2026-001.')).toBeVisible()
  await page.getByRole('button', { name: 'Save invoice defaults' }).click()
  await page.screenshot({ path: `${shots}/50-settings.png`, fullPage: true })

  // A rate needs a name.
  await page.getByRole('button', { name: 'Add tax rate' }).click()
  await page.getByRole('button', { name: 'Save tax rates' }).click()
  await expect(page.getByRole('alert')).toHaveText('Each rate needs a country, a name and a percentage from 0 to 100.')
  await page.getByRole('button', { name: 'Remove tax rate 3' }).click()

  await page.reload()
  await expect(page.getByTestId('tax-row')).toHaveCount(2)
  await expect(page.getByLabel('Rate (%) 1')).toHaveValue('19')
  await expect(page.getByLabel('Payment terms (days)')).toHaveValue('30')
})

test('profile: company name, address and logo for invoices', async ({ page }) => {
  await setUpBusiness(page)
  await page.reload()
  const form = page.getByTestId('business-form')
  await expect(form.getByLabel('Company name')).toHaveValue('Demo Design Studio')
  await expect(form.getByTestId('logo-preview').locator('img')).toBeVisible()
  await form.screenshot({ path: `${shots}/51-business-details.png` })

  // A file that is not an image is refused.
  await form.getByTestId('logo-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  await expect(form.getByRole('alert')).toContainText('could not be used as a logo')
})

test('creates an invoice from tracked time, sends it, and prints it as PDF', async ({ page }) => {
  await setUpTaxes(page)
  // Payment details from the example, as the client will see them under "Pay to".
  await page.getByRole('button', { name: 'Use example' }).click()
  await page.getByRole('button', { name: 'Save invoice defaults' }).click()
  await setUpBusiness(page)

  await page.goto('/#/invoices')
  await expect(page.getByTestId('invoices-empty')).toBeVisible()
  await page.getByRole('button', { name: 'New invoice' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'New invoice' })
  await dialog.getByLabel('Client').selectOption({ label: 'Nordlicht Studio · EUR' })
  await expect(dialog.getByLabel('From')).toHaveValue('2026-11-01')
  await expect(dialog.getByLabel('To')).toHaveValue('2026-11-12')
  await expect(dialog.getByTestId('time-preview')).toContainText('of billable time on')
  await page.screenshot({ path: `${shots}/52-new-invoice.png` })
  await dialog.getByRole('button', { name: 'Create draft' }).click()

  await expect(page).toHaveURL(/#\/invoices\/[\w-]+$/)
  await expect(page.getByTestId('invoice-title')).toHaveText('INV-2026-001')
  await expect(page.getByTestId('invoice-status')).toHaveText('Draft')
  // Berlin client → German rate picked automatically; lines are hours × € 45.
  await expect(page.getByLabel('Tax')).toHaveValue(/.+/)
  await expect(page.getByLabel('Tax').locator('option:checked')).toHaveText(/USt 19% · Germany/)
  const rows = page.getByTestId('item-row')
  await expect(rows.first()).toBeVisible()
  await expect(page.getByLabel('Rate 1')).toHaveValue('45')
  await expect(page.getByLabel('Due date')).toHaveValue('2026-11-26')

  // A hand-written line and a discount; totals follow.
  await page.getByRole('button', { name: 'Add line' }).click()
  const n = await rows.count()
  await page.getByLabel(`Description ${n}`).fill('Stock photo licence')
  await page.getByLabel(`Qty ${n}`).fill('1')
  // Tracked time is in hours; this line is a piece.
  await expect(page.getByLabel('Unit 1')).toHaveValue('Hours')
  await page.getByLabel(`Unit ${n}`).selectOption('Project')
  await page.getByLabel(`Rate ${n}`).fill('25,50')
  await page.getByLabel('Discount').fill('10')
  await expect(page.getByTestId('editor-totals')).toContainText('USt 19%')
  await page.screenshot({ path: `${shots}/53-invoice-editor.png`, fullPage: true })

  // Numbers must be unique.
  await page.getByRole('button', { name: 'Preview' }).click()
  const doc = page.getByTestId('invoice-doc').first()
  await expect(doc).toContainText('Demo Design Studio')
  await expect(doc).toContainText('01.234.567.8-901.000')
  await expect(doc).toContainText('Nordlicht Studio')
  await expect(doc).toContainText('Stock photo licence')
  await expect(doc.getByTestId('doc-unit').first()).toHaveText('Hours')
  await expect(doc.getByTestId('doc-unit').last()).toHaveText('Project')
  // Pay to (from Settings) at the bottom left, a handwritten thank-you at the bottom right.
  await expect(doc.getByTestId('doc-pay-to')).toHaveText('Pay to: Bank AAAAccount name: Your NameAccount number: 123 456 7890SWIFT Code: XXXXXXXX')
  await expect(doc.getByTestId('doc-thanks')).toHaveText('Thank you!')
  await expect(doc).not.toContainText('Thank you for your business')
  await expect(doc.locator('img')).toBeVisible()
  await page.screenshot({ path: `${shots}/54-invoice-preview.png`, fullPage: true })

  await page.getByRole('button', { name: 'Mark as sent' }).click()
  await expect(page.getByTestId('invoice-status')).toHaveText('Sent')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByText(/This invoice is sent, so it is locked/)).toBeVisible()
  await expect(page.getByLabel('Discount')).toBeDisabled()

  // Print: only the invoice is on the page.
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#root')).toBeHidden()
  await expect(page.locator('.print-root [data-testid="invoice-doc"]')).toBeVisible()
  await page.pdf({ path: `${shots}/INV-2026-001.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true })
  await page.screenshot({ path: `${shots}/55-invoice-print.png`, fullPage: true })
  await page.emulateMedia({ media: 'screen' })

  await page.getByRole('link', { name: 'All invoices' }).click()
  const row = page.getByTestId('invoice-row')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('INV-2026-001')
  await expect(row).toContainText('Sent')
  await expect(page.getByTestId('tile-sent')).toContainText('1')
  await page.screenshot({ path: `${shots}/56-invoices-list.png`, fullPage: true })

  // Paid: the amount due drops to zero and the stamp shows.
  await row.click()
  await page.getByRole('button', { name: 'Mark as paid' }).click()
  await expect(page.getByTestId('invoice-status')).toHaveText('Paid')
  await expect(page.getByTestId('invoice-doc').first().getByTestId('invoice-stamp')).toHaveText('PAID')
  await expect(page.getByTestId('invoice-doc').first().getByTestId('doc-amount-due')).toHaveText('€ 0')
})

test('a second invoice continues the numbering and warns about a period already billed', async ({ page }) => {
  await page.goto('/#/invoices')
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'New invoice' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'New invoice' })
    await dialog.getByLabel('Client').selectOption({ label: 'Nordlicht Studio · EUR' })
    if (i === 1) await expect(dialog.getByRole('alert')).toContainText('Part of this period is already billed in INV-2026-001.')
    await dialog.getByRole('button', { name: 'Create draft' }).click()
    await expect(page.getByTestId('invoice-title')).toHaveText(`INV-2026-00${i + 1}`)
    await page.getByRole('link', { name: 'All invoices' }).click()
  }
  // Drafts can be deleted.
  await page.getByTestId('invoice-row').filter({ hasText: 'INV-2026-002' }).click()
  await page.getByRole('button', { name: 'Delete draft' }).click()
  await page.getByRole('dialog', { name: 'Delete draft' }).getByRole('button', { name: 'Delete draft' }).click()
  await expect(page.getByTestId('invoice-row')).toHaveCount(1)
})

test('Indonesian invoice and phone layout', async ({ page }) => {
  await page.goto('/#/invoices')
  await page.getByRole('button', { name: 'ID', exact: true }).first().click()
  await page.getByRole('button', { name: 'Tagihan baru' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Tagihan baru' })
  await dialog.getByLabel('Klien').selectOption({ label: 'Warung Rasa · IDR' })
  await dialog.getByRole('button', { name: 'Buat draf' }).click()
  await page.getByRole('button', { name: 'Pratinjau' }).click()
  const doc = page.getByTestId('invoice-doc').first()
  await expect(doc).toContainText('Ditagihkan kepada')
  await expect(doc.getByTestId('doc-amount-due')).toHaveText(/^Rp [\d.]+,-$/)
  // Common units read in Indonesian; the picker keeps Hour and Hours apart.
  await expect(doc.getByTestId('doc-unit').first()).toHaveText('Jam')
  await page.getByRole('button', { name: 'Ubah' }).click()
  await expect(page.getByLabel('Satuan 1').locator('option')).toHaveText(['—', 'Jam · Hour', 'Jam · Hours', 'Layanan', 'Proyek'])
  await page.getByRole('button', { name: 'Pratinjau' }).click()

  await page.setViewportSize({ width: 390, height: 844 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.getByRole('link', { name: 'Semua tagihan' }).click()
  await expect(page.getByRole('heading', { name: 'Tagihan', level: 1 })).toBeVisible()
  await expect(page.getByTestId('bottom-nav').getByRole('link', { name: 'Tagihan' })).toBeVisible()
  await page.screenshot({ path: `${shots}/57-invoices-mobile.png`, fullPage: true })
})

test('the menu lists Invoices before Reports', async ({ page }) => {
  await page.goto('/#/')
  await expect(page.getByRole('navigation', { name: 'Main' }).first().getByRole('link')).toHaveText(['Dashboard', 'Tasks', 'Focus', 'Clients', 'Invoices', 'Reports', 'Settings'])
})

test('settings: units for invoice lines', async ({ page }) => {
  await page.goto('/#/settings')
  const units = page.getByTestId('unit-list')
  await expect(units.getByRole('listitem')).toHaveText(['Hour', 'Hours', 'Service', 'Project'])
  await page.getByLabel('New unit').fill('Day')
  await page.getByRole('button', { name: 'Add unit' }).click()
  await page.getByLabel('New unit').fill('day')
  await page.getByRole('button', { name: 'Add unit' }).click()
  await expect(page.getByText('This unit is already in the list.')).toBeVisible()
  await page.getByRole('button', { name: 'Pcs', exact: true }).click()
  await page.getByRole('button', { name: 'Remove unit Project' }).click()
  await page.getByRole('button', { name: 'Save units' }).click()
  await page.reload()
  await expect(units.getByRole('listitem')).toHaveText(['Hour', 'Hours', 'Service', 'Day', 'Pcs'])
  await page.getByRole('region', { name: 'Units' }).screenshot({ path: `${shots}/58-units.png` })

  // The editor offers them on each line.
  await page.goto('/#/invoices')
  await page.getByRole('button', { name: 'New invoice' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Create draft' }).click()
  await expect(page.getByLabel('Unit 1').locator('option')).toHaveText(['—', 'Hour', 'Hours', 'Service', 'Day', 'Pcs'])
})
