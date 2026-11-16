import { expect, test, type Page } from '@playwright/test'
import { signInAsDemo, startClockAt } from './helpers'

const shots = 'e2e-screenshots'

test.beforeEach(async ({ page }) => {
  await startClockAt(page, '2026-11-12T09:02:00Z')
  await signInAsDemo(page)
  // Record WhatsApp links instead of opening new windows.
  await page.addInitScript(() => {
    ;(window as unknown as { opened: string[] }).opened = []
    window.open = ((url: string) => {
      ;(window as unknown as { opened: string[] }).opened.push(url)
      return null
    }) as typeof window.open
  })
})

async function newInvoice(page: Page, client: string) {
  await page.goto('/#/invoices')
  await page.getByRole('button', { name: /New invoice|Invoice baru/ }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox').first().selectOption({ label: client })
  await dialog.getByRole('button', { name: /Create draft|Buat draf/ }).click()
  await expect(page.getByTestId('invoice-title')).toHaveText(/INV-2026-\d{3}/)
  return page.url()
}

async function addPhones(page: Page) {
  await page.goto('/#/profile')
  const form = page.getByTestId('business-form')
  await form.getByLabel('Company name').fill('Demo Design Studio')
  await form.getByLabel('Phone / WhatsApp').fill('+62 812 3456 7890')
  await form.getByRole('button', { name: 'Save business details' }).click()
  await expect(form.getByText('Saved')).toBeVisible()

  await page.goto('/#/clients')
  await page.getByTestId('client-row').filter({ hasText: 'Nordlicht Studio' }).getByRole('button', { name: 'Edit Nordlicht Studio' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit Nordlicht Studio' })
  // Berlin client → +49 is picked; only the local number is typed.
  await edit.getByLabel('Phone number').fill('0151 2345678')
  await edit.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(edit).toBeHidden()
}

test('the WhatsApp button waits for both phone numbers', async ({ page }) => {
  await newInvoice(page, 'Nordlicht Studio · EUR')
  const panel = page.getByTestId('wa-panel')
  await expect(panel.getByTestId('wa-send')).toBeDisabled()
  await expect(panel.getByTestId('wa-problems')).toContainText('Add a phone number for Nordlicht Studio')
  await expect(panel.getByTestId('wa-problems')).toContainText('Add your phone (WhatsApp) number in Business details.')
  await panel.screenshot({ path: `${shots}/60-whatsapp-disabled.png` })
})

test('sends a polite message with the details, then offers to mark it as sent', async ({ page }) => {
  await addPhones(page)
  const url = await newInvoice(page, 'Nordlicht Studio · EUR')
  const panel = page.getByTestId('wa-panel')
  await expect(panel.getByTestId('wa-to')).toHaveText('Lena · +49 151 2345678')
  const message = panel.getByTestId('wa-message')
  // A Berlin client gets English; every line, the total and the signature are in.
  await expect(message).toHaveValue(/^Hello Lena,\n\nI hope you are doing well\. Please find below the details of invoice \*INV-2026-001\* from Demo Design Studio\./)
  await expect(message).toHaveValue(/Hero section redesign \(Website refresh\)\n {3}4,17 × € 45 = € 187,65/)
  await expect(message).toHaveValue(/\*Total due: € [\d.,]+\*/)
  await expect(message).toHaveValue(/Kind regards,\nDemo Freelancer\nDemo Design Studio\n\+62 812 3456 7890$/)
  await panel.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${shots}/61-whatsapp-panel.png`, fullPage: true })

  // A personal touch is kept; Reset brings the template back.
  await message.fill('Hi Lena, invoice attached. Thanks!')
  await panel.getByTestId('wa-send').click()
  const opened = await page.evaluate(() => (window as unknown as { opened: string[] }).opened)
  expect(opened).toEqual(['https://wa.me/491512345678?text=Hi%20Lena%2C%20invoice%20attached.%20Thanks!'])
  await panel.getByRole('button', { name: 'Reset' }).click()
  await expect(message).toHaveValue(/^Hello Lena,/)

  // Indonesian version of the same message.
  await panel.getByRole('button', { name: 'Indonesia' }).click()
  await expect(message).toHaveValue(/^Halo Lena,\n\nSemoga Anda dalam keadaan baik\./)
  await expect(message).toHaveValue(/\*Total tagihan: € [\d.,]+\*/)

  await panel.getByRole('button', { name: 'Mark as sent' }).click()
  await expect(page.getByTestId('invoice-status')).toHaveText('Sent')
  expect(page.url()).toBe(url)
})

test('makes an image of the invoice to send', async ({ page }) => {
  await addPhones(page)
  await newInvoice(page, 'Nordlicht Studio · EUR')
  const panel = page.getByTestId('wa-panel')
  await panel.getByRole('button', { name: 'Invoice image' }).click()
  await expect(panel.getByTestId('wa-message')).toHaveValue(/^Hello Lena, please find attached invoice \*INV-2026-001\* for \*€ [\d.,]+\*, due on \*26 Nov 2026\*\./)
  const [download] = await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name: 'Download image' }).click()])
  expect(download.suggestedFilename()).toBe('INV-2026-001.png')
  const path = `${shots}/62-whatsapp-invoice-image.png`
  await download.saveAs(path)
  const { size } = await import('node:fs').then((fs) => fs.statSync(path))
  expect(size).toBeGreaterThan(30_000)
  await panel.screenshot({ path: `${shots}/63-whatsapp-image-mode.png` })
})

test('an Indonesian client gets an Indonesian message', async ({ page }) => {
  await newInvoice(page, 'Warung Rasa · IDR')
  await expect(page.getByTestId('wa-message')).toHaveValue(/^Halo Pak Budi,/)
  await expect(page.getByTestId('wa-message')).toHaveValue(/Rp [\d.]+,-/)
})
