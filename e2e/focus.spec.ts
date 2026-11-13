import { expect, test } from '@playwright/test'
import { signInAsDemo } from './helpers'

const shots = 'e2e-screenshots'

test.beforeEach(async ({ page }) => {
  // A controllable clock: it runs normally, and fastForward jumps ahead.
  await page.clock.install()
  await signInAsDemo(page)
  await page.goto('/#/tasks')
  await expect(page.getByTestId('task-card')).toHaveCount(8)
})

test('tracks time on a task from the drawer and shows it everywhere', async ({ page }) => {
  await page.getByTestId('task-card').filter({ hasText: 'Hero section redesign' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByTestId('task-total')).toHaveText('4h 10m')
  await dialog.getByRole('button', { name: 'Start timer' }).click()

  const bar = page.getByTestId('timer-bar')
  await expect(bar).toContainText('Tracking')
  await expect(bar).toContainText('Hero section redesign')
  await page.clock.fastForward('20:00')
  await expect(bar.getByTestId('timer-bar-clock')).toHaveText(/^20:0\d$/)
  await expect(page).toHaveTitle(/^▶ 20:0\d · Hero section redesign/)
  await page.screenshot({ path: `${shots}/08-timer-drawer.png` })

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('card-tracking')).toHaveCount(1)

  // The timer survives a reload: it lives in the database.
  await page.reload()
  await expect(page.getByTestId('timer-bar')).toContainText('Hero section redesign')
  await page.getByTestId('timer-bar').getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByTestId('timer-bar')).toHaveCount(0)

  await page.getByTestId('task-card').filter({ hasText: 'Hero section redesign' }).click()
  await expect(page.getByRole('dialog').getByTestId('task-total')).toHaveText('4h 30m')
  await expect(page.getByRole('dialog').getByTestId('time-entry')).toHaveCount(3)
})

test('logs time by hand and deletes an entry', async ({ page }) => {
  await page.getByTestId('task-card').filter({ hasText: 'Delivery app icons' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByTestId('task-total')).toHaveText('2h 40m')
  await dialog.getByLabel('Add time').fill('35')
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dialog.getByTestId('task-total')).toHaveText('3h 15m')
  await expect(dialog.getByTestId('time-entry').first()).toContainText('Manual')
  await dialog.getByTestId('time-entry').first().getByRole('button', { name: /Delete time entry/ }).click()
  await expect(dialog.getByTestId('task-total')).toHaveText('2h 40m')
})

test('runs a Pomodoro focus session and logs it to the task', async ({ page }) => {
  await page.getByRole('link', { name: 'Focus', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Focus', level: 1 })).toBeVisible()
  await expect(page.getByTestId('focus-clock')).toHaveText('25:00')

  // Shorter sessions keep the test quick; the setting persists.
  const focusField = page.getByRole('spinbutton', { name: 'Focus' })
  await focusField.fill('2')
  await focusField.press('Enter')
  await expect(page.getByTestId('focus-clock')).toHaveText('02:00')

  await page.getByLabel('Working on').selectOption({ label: 'Pricing page v2' })
  const timer = page.getByRole('region', { name: 'Pomodoro timer' })
  await timer.getByRole('button', { name: 'Start' }).click()
  await expect(timer.getByRole('button', { name: 'Pause' })).toBeVisible()
  await page.clock.fastForward('01:00')
  await expect(page.getByTestId('focus-clock')).toHaveText(/^01:0\d$|^00:5\d$/)
  await expect(page.getByTestId('timer-bar')).toContainText('Focus')
  await page.screenshot({ path: `${shots}/09-focus-running.png` })

  await page.clock.fastForward('01:05')
  const toast = page.getByTestId('phase-toast')
  await expect(toast).toContainText('Focus session done')
  await expect(toast).toContainText('Time for a short break.')
  await expect(page.getByTestId('focus-clock')).toHaveText('05:00')
  await expect(page.getByRole('button', { name: 'Short break', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('stat-sessions')).toHaveText('1')
  await page.screenshot({ path: `${shots}/10-focus-done.png` })

  // The finished session is in the task's time entries.
  await page.goto('/#/tasks?task=t-pricing')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByTestId('time-entry').first()).toContainText('Pomodoro')
  await expect(dialog.getByTestId('task-total')).toHaveText('5h 07m')
})

test('focus page works in Indonesian and on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'ID', exact: true }).click()
  await page.getByRole('link', { name: 'Fokus' }).click()
  await expect(page.getByRole('heading', { name: 'Fokus', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mulai' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.screenshot({ path: `${shots}/11-focus-mobile-id.png`, fullPage: true })
})
