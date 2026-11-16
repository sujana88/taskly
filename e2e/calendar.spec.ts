import { expect, test, type Page } from '@playwright/test'
import { signInAsDemo, startClockAt } from './helpers'

const shots = 'e2e-screenshots'
const day = (page: Page, key: string) => page.locator(`[data-testid="calendar-day"][data-day="${key}"]`)

test.beforeEach(async ({ page }) => {
  // Thursday 12 Nov 2026, 16:02 in Jakarta; sample deadlines are seeded relative to this moment.
  await startClockAt(page, '2026-11-12T09:02:00Z')
  await signInAsDemo(page)
  await page.goto('/#/tasks')
  await page.getByRole('button', { name: 'Calendar' }).click()
  await expect(page).toHaveURL(/view=calendar/)
})

test('shows tasks on their due day and moves between months', async ({ page }) => {
  await expect(page.getByTestId('calendar-title')).toHaveText('November 2026')
  await expect(page.getByText('8 tasks due this month')).toBeVisible()
  await expect(day(page, '2026-11-12').locator('[aria-current="date"]')).toHaveText('12')
  // Berlin 17:00 on Friday is 23:00 in Jakarta.
  await expect(day(page, '2026-11-13')).toContainText('23:00Hero section redesign')
  await page.screenshot({ path: `${shots}/30-calendar.png`, fullPage: true })

  // Clicking a task opens it.
  await day(page, '2026-11-13').getByTestId('calendar-task').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Next month' }).click()
  await expect(page.getByTestId('calendar-title')).toHaveText('December 2026')
  await expect(page).toHaveURL(/month=2026-12/)
  await page.getByRole('button', { name: 'Today' }).click()
  await expect(page.getByTestId('calendar-title')).toHaveText('November 2026')
  await expect(page).not.toHaveURL(/month=/)
})

test('drags a task to another day and keeps the time', async ({ page }) => {
  const chip = day(page, '2026-11-13').getByTestId('calendar-task').filter({ hasText: 'Hero section redesign' })
  // Keep both days away from the window edges, where dnd-kit auto-scrolls the page mid-drag.
  await day(page, '2026-11-20').evaluate((el) => el.scrollIntoView({ block: 'center' }))
  const from = (await chip.boundingBox())!
  const to = (await day(page, '2026-11-20').boundingBox())!
  await page.mouse.move(from.x + 20, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + 40, from.y + 20, { steps: 5 })
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 })
  await page.mouse.up()
  await expect(day(page, '2026-11-20')).toContainText('23:00Hero section redesign')
  await expect(day(page, '2026-11-13')).not.toContainText('Hero section redesign')
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.reload()
  await expect(day(page, '2026-11-20')).toContainText('Hero section redesign')
})

test('adds a task due on a chosen day', async ({ page }) => {
  await day(page, '2026-11-25').hover()
  await page.getByRole('button', { name: 'Add a task due 25 Nov' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Deadline', { exact: false }).first()).toHaveValue('2026-11-25T17:00')
  await page.keyboard.press('Escape')
  await expect(day(page, '2026-11-25')).toContainText('17:00Untitled task')
})

test('phones get a day-by-day agenda', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByTestId('calendar-grid')).toBeHidden()
  const agenda = page.getByTestId('calendar-agenda')
  await expect(agenda).toContainText('Thursday, 12 Nov · Today')
  await expect(agenda).toContainText('Friday, 13 Nov')
  await expect(agenda).toContainText('Hero section redesign')
})
