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
  await expect(rows.nth(0)).toContainText('Nordlicht Studio9h 15m€45€416.25')
  await expect(rows.nth(3)).toContainText('Warung Rasa2h 40mIDR 250,000IDR 666,667')
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
  await expect(popup.locator('tfoot')).toContainText('€416.25')
})

test('drafts a progress update with the best time to send', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
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
  await expect(page.getByRole('link', { name: 'Open in email' })).toHaveAttribute('href', /^mailto:jordan%40pinewood\.example\?subject=Pinewood%20Labs/)
})
