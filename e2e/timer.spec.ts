import { expect, test, type Page } from '@playwright/test'
import { signInAsDemo } from './helpers'

const shots = 'e2e-screenshots'

test.beforeEach(async ({ page }) => {
  // Monday 16 Nov 2026, 10:00 in Jakarta: inside the demo account's working hours (09–17).
  await page.clock.install({ time: new Date('2026-11-16T03:00:00Z') })
  await signInAsDemo(page)
})

async function openTask(page: Page, title: string) {
  await page.goto('/#/tasks')
  await page.getByTestId('task-card').filter({ hasText: title }).click()
  return page.getByRole('dialog')
}

async function startStandard(page: Page, task: string) {
  await page.goto('/#/focus')
  await page.getByRole('button', { name: 'Standard' }).click()
  await page.getByLabel('Working on').selectOption({ label: task })
  await page.getByTestId('standard-start').click()
  await expect(page.getByTestId('standard-stop')).toBeVisible()
}

test('logs manual time on another day, with a note, and warns about double counting', async ({ page }) => {
  const dialog = await openTask(page, 'Delivery app icons')
  await expect(dialog.getByTestId('task-total')).toHaveText('2h 40m')
  await dialog.getByRole('button', { name: 'Add time manually' }).click()
  const form = dialog.getByTestId('manual-form')
  await expect(form.getByLabel('Date')).toHaveValue('2026-11-16')
  await form.getByLabel('Date').fill('2026-11-15')
  await form.getByLabel('Start time').fill('06:00')
  await form.getByLabel('Hours').fill('1')
  await form.getByLabel('Minutes').fill('30')
  await form.getByLabel('What was done (optional)').fill('Call with the client about the icon set')
  await expect(form.getByTestId('manual-summary')).toHaveText('Sun 15 Nov, 06:00 – 07:30 · 1h 30m')
  await page.screenshot({ path: `${shots}/70-manual-time.png` })
  await form.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dialog.getByTestId('task-total')).toHaveText('4h 10m')
  const entry = dialog.getByTestId('time-entry').filter({ hasText: 'Sun 15 Nov, 06:00' })
  await expect(entry).toContainText('Manual')
  await expect(entry).toContainText('1h 30m')
  await expect(entry).toContainText('Call with the client about the icon set')

  // The same hour again: warned, and the button says so.
  await dialog.getByRole('button', { name: 'Add time manually' }).click()
  await form.getByLabel('Date').fill('2026-11-15')
  await form.getByLabel('Start time').fill('07:00')
  await form.getByLabel('Hours').fill('1')
  await form.getByLabel('Minutes').fill('0')
  await expect(form.getByTestId('manual-overlap')).toContainText('This overlaps 1 entry you already logged.')
  await expect(form.getByRole('button', { name: 'Add anyway' })).toBeVisible()

  // More than a day in one entry is refused.
  await form.getByLabel('Hours').fill('25')
  await expect(form.getByRole('alert')).toHaveText('One entry can be at most 24 hours.')
  await expect(form.getByRole('button', { name: /^Add/ })).toBeDisabled()
})

test('standard mode on the Focus page shows on the dashboard, and stops from there', async ({ page }) => {
  await startStandard(page, 'Pricing page v2')
  await page.clock.fastForward('05:00')
  await expect(page.getByTestId('standard-clock')).toHaveText(/^05:0\d$/)
  await expect(page.getByText('Started at 10:00')).toBeVisible()
  await page.screenshot({ path: `${shots}/71-focus-standard.png` })

  await page.goto('/#/')
  const card = page.getByTestId('active-standard')
  await expect(card).toContainText('Active timer')
  await expect(card).toContainText('Standard · Running')
  await expect(card.getByTestId('widget-task')).toHaveText('Pricing page v2')
  await expect(card).toContainText('Nordlicht Studio')
  await card.screenshot({ path: `${shots}/72-dashboard-active-timer.png` })
  await card.getByTestId('widget-stop').click()
  await expect(page.getByTestId('active-standard')).toHaveCount(0)
  await expect(page.getByTestId('widget-clock')).toBeVisible()
})

test('asks about time while the app was not running, and can drop it', async ({ page }) => {
  await startStandard(page, 'Pricing page v2')
  await page.clock.fastForward('02:00')
  // The device sleeps for 40 minutes.
  await page.clock.fastForward('40:00')
  const idle = page.getByRole('dialog', { name: 'Were you away?' })
  await expect(idle.getByTestId('idle-body')).toContainText('The timer for "Pricing page v2" kept running while the app was not open, since Mon 16 Nov, 10:02')
  await page.screenshot({ path: `${shots}/73-idle-dialog.png` })
  await idle.getByRole('button', { name: 'Remove it and continue' }).click()
  await expect(idle).toBeHidden()
  // The away time is gone: the new run starts from zero, the 2 minutes before are kept.
  await expect(page.getByTestId('standard-clock')).toHaveText(/^00:0\d$/)
  const dialog = await openTask(page, 'Pricing page v2')
  await expect(dialog.getByTestId('time-entry').nth(1)).toContainText('0h 02m')
})

test('asks "still working?" after 3 hours', async ({ page }) => {
  await startStandard(page, 'Pricing page v2')
  // Two hours of real work, then one more: no sleep in between, so no "away" question.
  for (let i = 0; i < 19; i++) await page.clock.fastForward('09:30')
  const still = page.getByTestId('still-working')
  await expect(still).toContainText('Still working?')
  await expect(still).toContainText('"Pricing page v2" has been running for 3h')
  await page.screenshot({ path: `${shots}/74-still-working.png` })
  await still.getByRole('button', { name: 'Yes, keep going' }).click()
  await expect(still).toBeHidden()
  await expect(page.getByTestId('standard-stop')).toBeVisible()
})

test('stops a forgotten timer after 12 hours and keeps it out of invoices until checked', async ({ page }) => {
  await startStandard(page, 'Pricing page v2')
  await page.clock.fastForward('13:00:00')
  const capped = page.getByRole('dialog', { name: 'Timer stopped automatically' })
  await expect(capped.getByTestId('capped-body')).toContainText('The timer for "Pricing page v2" ran for 12 hours, so it was stopped.')
  await capped.getByRole('button', { name: 'OK' }).click()
  await expect(page.getByTestId('standard-start')).toBeVisible()

  const dialog = await openTask(page, 'Pricing page v2')
  const review = dialog.getByTestId('needs-review')
  await expect(review).toContainText('Stopped automatically: check the time. Not billed until checked.')
  await expect(dialog.getByTestId('time-entry').first()).toContainText('12h 00m')
  await dialog.screenshot({ path: `${shots}/75-needs-review.png` })
  await review.getByRole('button', { name: 'Checked' }).click()
  await expect(dialog.getByTestId('needs-review')).toHaveCount(0)
})

test('timer safety settings are saved', async ({ page }) => {
  await page.goto('/#/settings')
  const section = page.getByRole('region', { name: 'Timer' })
  await expect(section.getByLabel('Ask "still working?" after')).toHaveValue('3')
  await section.getByLabel('Ask "still working?" after').fill('2')
  await section.getByLabel('Stop by itself after').fill('10')
  await expect(section).toContainText('Reminder after 2 h (and when your workday ends), away check after 10 min, automatic stop after 10 h.')
  await section.getByRole('button', { name: 'Save timer settings' }).click()
  await page.reload()
  await expect(page.getByRole('region', { name: 'Timer' }).getByLabel('Stop by itself after')).toHaveValue('10')
  await page.goto('/#/focus')
  await page.getByRole('button', { name: 'Standard' }).click()
  await expect(page.getByRole('region', { name: 'Forgotten-timer safety' })).toContainText('after 2 hours')
})

test('a memo on the Focus page is saved on the time entry, in both modes', async ({ page }) => {
  await page.goto('/#/focus')
  await page.getByRole('button', { name: 'Standard' }).click()
  await expect(page.getByText('Time tracking')).toBeVisible()
  await expect(page.getByTestId('standard-info')).toHaveText('Counts up. Stop when you are done.')
  await page.getByLabel('Working on').selectOption({ label: 'Pricing page v2' })
  const memo = page.getByLabel('Memo')
  await memo.fill('Comparison table layout')
  await page.getByTestId('standard-start').click()
  await page.clock.fastForward('03:00')
  // Edited while running: the entry follows.
  await memo.fill('Comparison table layout and FAQ')
  await page.clock.fastForward('00:02')
  await page.screenshot({ path: `${shots}/76-focus-memo.png` })
  await page.getByTestId('standard-stop').click()

  // Pomodoro: the memo goes onto the focus block too.
  await page.getByRole('button', { name: 'Pomodoro' }).click()
  await expect(memo).toHaveValue('Comparison table layout and FAQ')
  await memo.fill('Final polish')
  await page.getByRole('region', { name: 'Pomodoro timer' }).getByRole('button', { name: 'Start' }).click()
  await page.clock.fastForward('02:00')
  await page.getByRole('region', { name: 'Pomodoro timer' }).getByRole('button', { name: 'Pause' }).click()

  const dialog = await openTask(page, 'Pricing page v2')
  const entries = dialog.getByTestId('time-entry')
  await expect(entries.nth(0)).toContainText('Pomodoro')
  await expect(entries.nth(0)).toContainText('Final polish')
  await expect(entries.nth(1)).toContainText('Timer')
  await expect(entries.nth(1)).toContainText('Comparison table layout and FAQ')
})
