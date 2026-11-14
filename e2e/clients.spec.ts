import { expect, test, type Page } from '@playwright/test'
import { signInAsDemo, startClockAt } from './helpers'

const shots = 'e2e-screenshots'
const row = (page: Page, name: string) => page.getByTestId('client-row').filter({ hasText: name })

test.beforeEach(async ({ page }) => {
  // Thursday 12 Nov 2026, 16:02 in Jakarta (the browser zone in playwright.config.ts).
  await startClockAt(page, '2026-11-12T09:02:00Z')
  await signInAsDemo(page)
  await page.goto('/#/clients')
  await expect(page.getByTestId('client-row')).toHaveCount(4)
})

test('shows each client with local time, status, overlap and best time to send', async ({ page }) => {
  await expect(page.getByText('Each day shown in your time zone (Jakarta, UTC+7). Now: Thu 12 Nov, 16:02.')).toBeVisible()

  const berlin = row(page, 'Nordlicht Studio')
  await expect(berlin).toContainText('10:02')
  await expect(berlin).toContainText('Berlin · UTC+1')
  await expect(berlin.getByTestId('client-status')).toHaveText('Working now')
  await expect(berlin.getByTestId('overlap-summary')).toHaveText('2h overlap · client hours 15:00–23:00 your time')
  await expect(berlin.getByTestId('best-time')).toHaveText('Now · they are online until 23:00')

  const sydney = row(page, 'Harbour Digital')
  await expect(sydney.getByTestId('client-status')).toHaveText('Off hours')
  await expect(sydney.getByTestId('overlap-summary')).toHaveText('4h overlap · client hours 05:00–13:00 your time')
  await expect(sydney.getByTestId('best-time')).toHaveText('Fri 09:00 (13:00 Sydney)')

  const ny = row(page, 'Pinewood Labs')
  await expect(ny.getByTestId('client-status')).toHaveText('Asleep')
  await expect(ny.getByTestId('overlap-summary')).toHaveText('No overlap · client hours 21:00–05:00 your time')
  await expect(ny.getByTestId('best-time')).toHaveText('Schedule for 21:00 (09:00 New York)')

  const jakarta = row(page, 'Warung Rasa')
  await expect(jakarta.getByTestId('overlap-summary')).toHaveText('8h overlap · client hours 09:00–17:00 your time')
  await expect(jakarta.getByTestId('best-time')).toHaveText('Now · same time zone')

  // Every dollar gets its letters; Rupiah is written the Indonesian way.
  await expect(ny).toContainText('Rate US $ 60 / h')
  await expect(sydney).toContainText('Rate A $ 70 / h')
  await expect(jakarta).toContainText('Rate Rp 250.000,- / h')
  await expect(berlin).toContainText('Rate € 45 / h')

  await expect(
    page.getByText('Daylight saving is handled per city: New York changes to UTC−4 on 14 Mar; Berlin changes to UTC+2 on 28 Mar; Sydney changes to UTC+10 on 4 Apr.'),
  ).toBeVisible()
  await page.screenshot({ path: `${shots}/14-clients.png`, fullPage: true })
})

test('steps through days: weekends have no client hours', async ({ page }) => {
  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(page.getByTestId('day-label')).toHaveText('Friday 13 Nov')
  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(row(page, 'Nordlicht Studio').getByTestId('overlap-summary')).toHaveText('No overlap · not working this day')
  await page.getByRole('button', { name: 'Today' }).click()
  await expect(page.getByTestId('day-label')).toHaveText('Today')
})

test('adds a client, then edits, archives and restores it', async ({ page }) => {
  await page.getByRole('button', { name: 'Add client' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add client' })
  await dialog.getByRole('button', { name: 'Add client' }).click()
  await expect(dialog.getByText('Enter a name.')).toBeVisible()

  await dialog.getByLabel('Client name').fill('Tokyo Ramen')
  await dialog.getByLabel('Time zone').selectOption('Asia/Tokyo')
  await expect(dialog).toContainText('Working hours in Tokyo')
  await dialog.getByLabel('Hourly rate').fill('8000')
  await dialog.getByLabel('Currency').selectOption('JPY')

  // Phone, website and note: checked, tidied (https:// added) and saved.
  await dialog.getByLabel('Phone number').fill('call me')
  await dialog.getByRole('button', { name: 'Add client' }).click()
  await expect(dialog.getByText('Use digits, spaces and + ( ) - only, 6 to 30 characters.')).toBeVisible()
  await dialog.getByLabel('Phone number').fill('+81 3-1234-5678')
  await dialog.getByLabel('Website').fill('tokyo-ramen.example')
  await dialog.getByLabel('Website').blur()
  await expect(dialog.getByLabel('Website')).toHaveValue('https://tokyo-ramen.example')
  await dialog.getByLabel('Note').fill('Invoices in JPY, monthly. Prefers LINE for quick questions.')
  await expect(dialog.getByText('59/4000')).toBeVisible()
  await page.screenshot({ path: `${shots}/15-add-client.png` })
  await dialog.getByRole('button', { name: 'Add client' }).click()
  await expect(dialog).toBeHidden()

  const tokyo = row(page, 'Tokyo Ramen')
  await expect(tokyo).toContainText('Tokyo · UTC+9')
  await expect(tokyo.getByTestId('overlap-summary')).toHaveText('6h overlap · client hours 07:00–15:00 your time')
  await expect(tokyo).toContainText('Rate ¥ 8.000 / h')

  // The new client is available for tasks right away.
  await page.goto('/#/tasks')
  await expect(page.getByRole('combobox', { name: 'Client' }).locator('option', { hasText: 'Tokyo Ramen' })).toHaveCount(1)
  await page.goto('/#/clients')

  await row(page, 'Tokyo Ramen').getByRole('button', { name: 'Edit Tokyo Ramen' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit Tokyo Ramen' })
  await expect(edit.getByLabel('Phone number')).toHaveValue('+81 3-1234-5678')
  await expect(edit.getByLabel('Website')).toHaveValue('https://tokyo-ramen.example')
  await expect(edit.getByLabel('Note')).toHaveValue('Invoices in JPY, monthly. Prefers LINE for quick questions.')
  await edit.getByPlaceholder('Add a project').fill('Menu app')
  await edit.getByPlaceholder('Add a project').press('Enter')
  await expect(edit.getByLabel('Project name')).toHaveCount(2)
  await edit.getByRole('button', { name: 'Archive client' }).click()
  await expect(page.getByTestId('client-row')).toHaveCount(4)

  await page.getByRole('button', { name: 'Archived (1)' }).click()
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByTestId('client-row')).toHaveCount(5)
})

test('changing my working hours updates every overlap', async ({ page }) => {
  await page.getByRole('button', { name: 'My hours' }).click()
  const dialog = page.getByRole('dialog', { name: 'Your working hours' })
  await dialog.getByLabel('Start').fill('12:00')
  await dialog.getByLabel('End').fill('20:00')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Your working hours (12:00–20:00)')).toBeVisible()
  await expect(row(page, 'Nordlicht Studio').getByTestId('overlap-summary')).toContainText('5h overlap')
  await expect(row(page, 'Harbour Digital').getByTestId('overlap-summary')).toContainText('1h overlap')
  // Saved to the account: still there after a reload.
  await page.reload()
  await expect(page.getByText('Your working hours (12:00–20:00)')).toBeVisible()
})

test('clients page fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: 'Clients', level: 1 })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.screenshot({ path: `${shots}/16-clients-mobile.png`, fullPage: true })
})
