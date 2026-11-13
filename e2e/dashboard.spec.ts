import { expect, test } from '@playwright/test'
import { signInAsDemo, startClockAt } from './helpers'

const shots = 'e2e-screenshots'

test.beforeEach(async ({ page }) => {
  // Thursday 12 Nov 2026, 16:02 in Jakarta; the sample data is seeded relative to this moment.
  await startClockAt(page, '2026-11-12T09:02:00Z')
  await signInAsDemo(page)
  await page.goto('/#/')
})

test('the dashboard greets the user and summarises the week', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Good afternoon, Demo')
  await expect(page.getByTestId('hero-summary')).toHaveText('1 task is due this week and 2 are in progress.')
  await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')

  const upcoming = page.getByTestId('upcoming').getByRole('listitem')
  await expect(upcoming).toHaveCount(6)
  await expect(upcoming.first()).toContainText('Hero section redesign')
  await expect(upcoming.first()).toContainText('Tomorrow 23:00')
  await expect(page.getByText('27h 25m').first()).toBeVisible()
  await page.screenshot({ path: `${shots}/17-dashboard.png`, fullPage: true })

  // Ticking a deadline marks the task done.
  await page.getByRole('checkbox', { name: 'Mark Hero section redesign as done' }).check()
  await expect(upcoming.first()).not.toContainText('Hero section redesign')
  await expect(page.getByText('2 of 8 tasks done')).toBeVisible()
})

test('the focus widget starts the Pomodoro from the dashboard', async ({ page }) => {
  await expect(page.getByTestId('widget-clock')).toHaveText('25:00')
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true }).first()).toBeVisible()
  await expect(page.getByTestId('timer-bar')).toContainText('Focus')
})

test('links lead to tasks, reports and clients', async ({ page }) => {
  await page.getByRole('link', { name: 'View tasks' }).click()
  await expect(page).toHaveURL(/#\/tasks$/)
  await page.goto('/#/')
  await page.getByRole('link', { name: 'Report', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Weekly report' })).toBeVisible()
})
