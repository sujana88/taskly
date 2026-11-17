import { expect, test } from '@playwright/test'
import { signInAsDemo, startClockAt } from './helpers'

const shots = 'e2e-screenshots'
const TITLE = 'Hero section redesign' // In progress, 4h 10m logged in the demo data

test.beforeEach(async ({ page }) => {
  await startClockAt(page, '2026-11-12T09:02:00Z')
  await signInAsDemo(page)
  await page.goto('/#/tasks')
  await expect(page.getByTestId('count-in_progress')).toHaveText('2')
})

test('cancels a task from its card: time is removed, and Restore brings it back with 0h', async ({ page }) => {
  // Only unfinished cards offer Cancel (7 open cards, the Done one does not).
  await expect(page.getByTestId('card-cancel')).toHaveCount(7)
  await expect(page.getByTestId('column-done').getByTestId('card-cancel')).toHaveCount(0)

  await page.getByRole('button', { name: `Cancel ${TITLE}` }).click()
  const dialog = page.getByRole('dialog', { name: `Cancel “${TITLE}”?` })
  await expect(dialog.getByTestId('cancel-confirm-body')).toContainText('the 4h 10m logged on it is removed')
  await page.screenshot({ path: `${shots}/43-cancel-confirm.png` })
  // "Keep task" changes nothing.
  await dialog.getByRole('button', { name: 'Keep task' }).click()
  await expect(page.getByTestId('count-in_progress')).toHaveText('2')

  await page.getByRole('button', { name: `Cancel ${TITLE}` }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel task' }).click()
  await expect(page.getByTestId('count-in_progress')).toHaveText('1')
  await expect(page.getByTestId('task-card').filter({ hasText: TITLE })).toHaveCount(0)

  // Not billed: the weekly report no longer has its time.
  const tabs = page.getByRole('group', { name: 'View' })
  await expect(tabs.getByRole('button', { name: /^Cancelled/ })).toContainText('1')
  await tabs.getByRole('button', { name: /^Cancelled/ }).click()
  await expect(page).toHaveURL(/view=cancelled/)
  const row = page.getByTestId('cancelled-row')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText(TITLE)
  await expect(row).toContainText('In progress · Cancelled')
  await expect(row).toContainText('0h 00m')
  await page.screenshot({ path: `${shots}/44-cancelled-view.png`, fullPage: true })

  await row.getByRole('button', { name: TITLE, exact: true }).click()
  await expect(page.getByTestId('drawer-cancelled')).toContainText('Cancelled on')
  await page.keyboard.press('Escape')

  await row.getByRole('button', { name: `Restore ${TITLE}` }).click()
  await expect(page.getByTestId('cancelled-empty')).toBeVisible()
  await page.reload()
  await tabs.getByRole('button', { name: 'Kanban' }).click()
  const card = page.getByTestId('column-in_progress').getByTestId('task-card').filter({ hasText: TITLE })
  await expect(card).toContainText('0h 00m')
})

test('cancelling stops a timer running on the task and leaves it out of the dashboard', async ({ page }) => {
  await page.getByTestId('task-card').filter({ hasText: TITLE }).click()
  const drawer = page.getByRole('dialog', { name: TITLE, exact: true })
  await drawer.getByRole('button', { name: 'Start timer' }).click()
  await expect(page.getByTestId('timer-bar')).toContainText(TITLE)

  await drawer.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('dialog', { name: `Cancel “${TITLE}”?` }).getByRole('button', { name: 'Cancel task' }).click()
  await expect(drawer.getByTestId('drawer-cancelled')).toBeVisible()
  await expect(page.getByTestId('timer-bar').filter({ hasText: TITLE })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.goto('/#/')
  await expect(page.getByTestId('hero-summary')).toContainText('1 task is currently in progress')
})

test('Indonesian labels', async ({ page }) => {
  await page.getByRole('button', { name: 'ID', exact: true }).click()
  await page.getByRole('button', { name: `Batalkan ${TITLE}` }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Batalkan tugas' }).click()
  await page.getByRole('group', { name: 'Tampilan' }).getByRole('button', { name: /^Dibatalkan/ }).click()
  await expect(page.getByTestId('cancelled-row')).toContainText('Dikerjakan · Dibatalkan')
})

test('the view tabs fit a phone screen (the row scrolls, the page does not)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const tabs = page.getByRole('group', { name: 'View' })
  const box = (await tabs.boundingBox())!
  expect(box.x + box.width).toBeLessThanOrEqual(390 - 16)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  await tabs.getByRole('button', { name: /^Delivered/ }).scrollIntoViewIfNeeded()
  await tabs.getByRole('button', { name: /^Delivered/ }).click()
  await expect(page).toHaveURL(/view=delivered/)
  await tabs.screenshot({ path: `${shots}/45-view-tabs-mobile.png` })
})
