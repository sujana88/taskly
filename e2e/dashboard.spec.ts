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
  await expect(page.getByTestId('hero-summary')).toHaveText('There is 1 task that must be completed within these 3 days. 3 tasks are in the to-do state, 2 tasks are under revision and 2 tasks are currently in progress.')
  await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')

  const upcoming = page.getByTestId('upcoming').getByRole('listitem')
  await expect(upcoming).toHaveCount(6)
  await expect(upcoming.first()).toContainText('Hero section redesign')
  await expect(upcoming.first()).toContainText('Tomorrow 23:00')
  await expect(page.getByText('27h 25m').first()).toBeVisible()
  await page.screenshot({ path: `${shots}/17-dashboard.png`, fullPage: true })

  // Ticking a deadline marks the task done.
  await page.getByRole('checkbox', { name: 'Mark Hero section redesign as done' }).click()
  await expect(upcoming.first()).not.toContainText('Hero section redesign')
  await expect(page.getByText('2 of 8 tasks done')).toBeVisible()
})

test('the focus widget starts the Pomodoro from the dashboard', async ({ page }) => {
  await expect(page.getByTestId('widget-clock')).toHaveText('25:00')
  await expect(page.getByTestId('widget-phase')).toHaveText('Focus · Ready')
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true }).first()).toBeVisible()
  await expect(page.getByTestId('timer-bar')).toContainText('Focus')
  await expect(page.getByTestId('widget-phase')).toHaveText('Focus · Running')
  // The widget counts down every second, in step with the timer bar.
  await expect(page.getByTestId('widget-clock')).toHaveText(/^24:5[0-8]$/, { timeout: 5000 })
  await expect(page.getByTestId('widget-clock')).not.toHaveText(await page.getByTestId('widget-clock').innerText(), { timeout: 3000 })
})

test('links lead to tasks, reports and clients', async ({ page }) => {
  await page.getByRole('link', { name: 'View tasks' }).click()
  await expect(page).toHaveURL(/#\/tasks$/)
  await page.goto('/#/')
  await page.getByRole('link', { name: 'Report', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Weekly report' })).toBeVisible()
})

test('the focus widget says which phase is running, also during a break', async ({ page }) => {
  await page.goto('/#/focus')
  await page.getByRole('button', { name: 'Skip' }).first().click()
  await page.goto('/#/')
  await expect(page.getByTestId('widget-phase')).toHaveText('Short break · Ready')
  await expect(page.getByTestId('widget-clock')).toHaveText('05:00')
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByTestId('widget-phase')).toHaveText('Short break · Running')
  await expect(page.getByText('Step away from the screen for a moment.')).toBeVisible()
  await expect(page.getByTestId('timer-bar')).toContainText('Short break')
  await page.getByRole('region', { name: 'Focus timer' }).screenshot({ path: 'e2e-screenshots/31-focus-widget-break.png' })
})

test('the summary reads naturally in Indonesian', async ({ page }) => {
  await page.getByRole('button', { name: 'ID', exact: true }).click()
  await expect(page.getByTestId('hero-summary')).toHaveText(
    'Terdapat 1 tugas yang harus diselesaikan dalam kurun waktu 3 hari ini. 3 tugas berstatus belum dikerjakan, 2 tugas sedang dalam tahap revisi, dan 2 tugas sedang dalam proses pengerjaan.',
  )
})
