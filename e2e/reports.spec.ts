import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { signInAsDemo, startClockAt } from './helpers'

const shots = 'e2e-screenshots'

test.beforeEach(async ({ page }) => {
  // Thursday 12 Nov 2026, 16:02 in Jakarta; the sample data is seeded relative to this moment.
  await startClockAt(page, '2026-11-12T09:02:00Z')
  await signInAsDemo(page)
  await page.goto('/#/reports')
  await expect(page.getByRole('heading', { name: 'Weekly report' })).toBeVisible()
})

test('summarises the week with tiles, charts and a timesheet', async ({ page }) => {
  await expect(page.getByTestId('week-range')).toHaveText('Mon 9 Nov – Sun 15 Nov 2026')
  await expect(page.getByTestId('stat-tracked')).toHaveText('27h 25m')
  await expect(page.getByTestId('stat-average')).toHaveText('13h 43m')
  await expect(page.getByTestId('stat-done')).toHaveText('1')
  await expect(page.getByTestId('stat-sessions')).toHaveText('0')
  await expect(page.getByRole('heading', { name: 'Wednesday was the longest day at 15h 55m' })).toBeVisible()
  await expect(page.getByTestId('day-bar')).toHaveCount(7)
  await expect(page.getByRole('img', { name: 'Tuesday 10 Nov: 11h 30m' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nordlicht Studio took 34% of the week' })).toBeVisible()

  const rows = page.getByTestId('timesheet').locator('tbody tr')
  await expect(rows).toHaveCount(4)
  await expect(rows.nth(0)).toContainText('Nordlicht Studio9h 15m€ 45€ 416,25')
  await expect(rows.nth(3)).toContainText('Warung Rasa2h 40mRp 250.000,-Rp 666.667,-')
  await page.screenshot({ path: `${shots}/18-reports.png`, fullPage: true })

  // Last week has no data; the next-week button is off for the current week.
  await expect(page.getByTestId('week-name')).toHaveText('This week')
  await expect(page.getByRole('button', { name: 'Next week' })).toBeDisabled()
  await page.getByRole('button', { name: 'Previous week' }).click()
  await expect(page.getByTestId('week-range')).toHaveText('Mon 2 Nov – Sun 8 Nov 2026')
  await expect(page.getByTestId('week-name')).toHaveText('Last week')
  await expect(page.getByText('No time tracked this week yet.').first()).toBeVisible()
  await page.getByRole('button', { name: 'This week' }).click()
  await expect(page.getByTestId('stat-tracked')).toHaveText('27h 25m')
})

test('exports the timesheet as CSV and opens a printable PDF', async ({ page }) => {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export all (CSV)' }).click()])
  expect(download.suggestedFilename()).toBe('taskly-timesheet-2026-11-09.csv')
  const csv = await readFile((await download.path())!, 'utf8')
  const lines = csv.replace(/^﻿/, '').split('\r\n')
  expect(lines[0]).toBe('Date,Start,End,Client,Project,Task,Source,Hours,Rate,Amount,Currency')
  expect(lines).toHaveLength(11)

  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Timesheet PDF for Nordlicht Studio' }).click()])
  await expect(popup.getByRole('heading', { name: 'Timesheet · Nordlicht Studio' })).toBeVisible()
  await expect(popup.locator('tfoot')).toContainText('9h 15m')
  await expect(popup.locator('tfoot')).toContainText('€ 416,25')
})

test('drafts a progress update with the best time to send', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  // The message for the client lives on the Client report tab, not on your own report.
  await expect(page.getByTestId('update-text')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Client report' }).click()
  const text = page.getByTestId('update-text')
  await expect(text).toHaveValue(/^Hi Lena, here is this week's update\./)
  await expect(text).toHaveValue(/In progress: Hero section redesign, 3 of 5 steps done\./)
  await expect(text).toHaveValue(/Time logged this week: 9h 15m\./)
  await expect(page.getByTestId('send-hint')).toHaveText("Send now: it's 10:02 in Berlin, inside their working hours.")

  // Edits are kept, copying puts them on the clipboard.
  await text.fill('Hi Lena, short one this week.')
  await page.getByRole('button', { name: 'Copy text' }).click()
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Hi Lena, short one this week.')

  await page.getByLabel('Client', { exact: true }).selectOption({ label: 'Pinewood Labs' })
  await expect(text).toHaveValue(/^Hi Jordan,/)
  await expect(text).toHaveValue(/Done: Design system audit is ready for your review\./)
  await expect(page.getByTestId('send-hint')).toContainText("Better later: it's 04:02 in New York. Send Thu 21:00 your time (09:00 there).")
  await expect(page.getByRole('link', { name: 'Email', exact: true }).first()).toHaveAttribute('href', /^mailto:jordan%40pinewood\.example\?subject=Pinewood%20Labs/)
})

test('client report: a progress report document to send, like an invoice', async ({ page }) => {
  await page.getByRole('tab', { name: 'Client report' }).click()
  await expect(page).toHaveURL(/tab=client/)
  const doc = page.locator('#root [data-testid="progress-doc"]')
  await expect(doc.getByRole('heading', { name: 'PROGRESS REPORT' })).toBeVisible()
  await expect(doc.getByTestId('progress-number')).toHaveText('PR-20261109-NS')
  await expect(doc.getByTestId('progress-client')).toHaveText('Nordlicht Studio')
  await expect(doc.getByTestId('progress-period')).toHaveText('9 Nov 2026 – 15 Nov 2026')
  await expect(doc.getByTestId('progress-health')).toHaveText('On track')
  await expect(doc.getByTestId('progress-row')).toHaveCount(2)
  await expect(doc.getByTestId('progress-row').nth(0)).toContainText('Pricing page v2')
  await expect(doc.getByTestId('progress-pct')).toHaveText(['80%', '60%'])
  await expect(doc.getByRole('img', { name: 'complete' })).toContainText('70%')
  await expect(doc.getByTestId('progress-next')).toContainText('High-fidelity desktop version (Hero section redesign)')
  // Rates and money never appear on the client's report.
  await expect(doc).not.toContainText('€')

  await page.getByLabel('Notes for the client').fill('Waiting for the final copy for the pricing FAQ.')
  await expect(doc).toContainText('Waiting for the final copy for the pricing FAQ.')
  await doc.screenshot({ path: `${shots}/62-progress-report.png` })
  await page.screenshot({ path: `${shots}/63-client-report.png`, fullPage: true })

  // Another client: its own number, the finished task listed as completed.
  await page.getByLabel('Client', { exact: true }).selectOption({ label: 'Pinewood Labs' })
  await expect(doc.getByTestId('progress-number')).toHaveText('PR-20261109-PL')
  await expect(doc.getByTestId('progress-completed')).toContainText('Design system audit')
  await expect(page.getByLabel('Notes for the client')).toHaveValue('')

  // Printing shows only the report.
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.print-root [data-testid="progress-doc"]')).toBeVisible()
  await expect(page.locator('#root')).toBeHidden()
})

test('delivery message: hand a finished task over, then mark it delivered', async ({ page }) => {
  // From the finished task's panel.
  await page.goto('/#/tasks')
  await page.getByTestId('task-card').filter({ hasText: 'Design system audit' }).click()
  await page.getByTestId('drawer-delivery-message').click()
  await expect(page).toHaveURL(/tab=client&client=c-pine&deliver=t-audit/)

  const card = page.getByTestId('delivery-card')
  await expect(card.getByLabel('Finished task')).toHaveValue('t-audit')
  const text = card.getByTestId('delivery-text')
  await expect(text).toHaveValue(/^Hi Jordan,\n\nGood news: Design system audit is finished and ready for you\./)
  await expect(text).toHaveValue(/What is included:\n- Inventory\n- Colour tokens\n- Type scale\n- Report/)
  await expect(text).toHaveValue(/I have attached the final files/)
  await card.getByLabel('Link to the files (optional)').fill('https://drive.example/audit')
  await expect(text).toHaveValue(/You can find everything here: https:\/\/drive\.example\/audit/)
  await expect(card.getByRole('link', { name: 'Email' })).toHaveAttribute('href', /subject=Delivered%3A%20Design%20system%20audit/)
  await card.screenshot({ path: `${shots}/64-delivery-message.png` })

  await card.getByRole('button', { name: 'Mark as delivered' }).click()
  await expect(card.getByRole('status')).toHaveText('Design system audit is marked as delivered.')
  await expect(card.getByTestId('delivery-empty')).toBeVisible()
  await page.goto('/#/tasks')
  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: /^Delivered/ }).click()
  await expect(page.getByTestId('delivered-row').filter({ hasText: 'Design system audit' })).toHaveCount(1)
})

test('client report in Indonesian', async ({ page }) => {
  await page.getByRole('button', { name: 'ID', exact: true }).click()
  await page.getByRole('tab', { name: 'Laporan klien' }).click()
  const doc = page.locator('#root [data-testid="progress-doc"]')
  await expect(doc.getByRole('heading', { name: 'LAPORAN PROGRES' })).toBeVisible()
  await expect(doc.getByTestId('progress-health')).toHaveText('Sesuai jadwal')
  await page.getByLabel('Klien', { exact: true }).selectOption({ label: 'Pinewood Labs' })
  await expect(page.getByTestId('delivery-text')).toHaveValue(/^Halo Jordan,\n\nKabar baik: Design system audit sudah selesai/)
})
