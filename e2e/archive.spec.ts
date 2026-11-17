import { expect, test } from '@playwright/test'
import { signInAsDemo, startClockAt } from './helpers'

const shots = 'e2e-screenshots'

test.beforeEach(async ({ page }) => {
  await startClockAt(page, '2026-11-12T09:02:00Z')
  await signInAsDemo(page)
  await page.goto('/#/tasks')
  await expect(page.getByTestId('column-done').getByTestId('task-card')).toHaveCount(1)
})

test('archives a finished task from its card and restores it from the Archive view', async ({ page }) => {
  const done = page.getByTestId('column-done')
  await expect(page.getByTestId('count-done')).toHaveText('1')
  // Only finished cards offer Archive.
  await expect(page.getByTestId('card-archive')).toHaveCount(1)
  await page.screenshot({ path: `${shots}/40-archive-button.png` })

  await done.getByRole('button', { name: 'Archive Design system audit' }).click()
  await expect(done.getByTestId('task-card')).toHaveCount(0)
  await expect(page.getByTestId('count-done')).toHaveText('0')
  // Gone from the list as well.
  await page.getByRole('button', { name: 'List', exact: true }).click()
  await expect(page.getByTestId('task-table')).not.toContainText('Design system audit')

  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: /^Archive/ }).click()
  await expect(page).toHaveURL(/view=archive/)
  const row = page.getByTestId('archive-row')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Design system audit')
  await expect(row).toContainText('Done · Archived')
  await expect(row).toContainText('Pinewood Labs')
  await page.screenshot({ path: `${shots}/41-archive-view.png`, fullPage: true })

  // Opening it shows that it is archived; Restore brings it back to Done.
  await row.getByRole('button', { name: 'Design system audit', exact: true }).click()
  await expect(page.getByTestId('drawer-archived')).toContainText('Archived on')
  await page.keyboard.press('Escape')
  await row.getByRole('button', { name: 'Restore Design system audit' }).click()
  await expect(page.getByTestId('archive-empty')).toBeVisible()

  // Survives a reload (saved, not just hidden on screen).
  await page.reload()
  await page.getByRole('button', { name: 'Kanban' }).click()
  await expect(done.getByTestId('task-card')).toHaveCount(1)
})

test('archives from the task panel, and moving it out of Done un-archives it', async ({ page }) => {
  await page.getByTestId('column-done').getByTestId('task-card').click()
  const drawer = page.getByRole('dialog')
  await drawer.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(drawer.getByTestId('drawer-archived')).toBeVisible()
  await drawer.getByLabel('Status').selectOption('in_revision')
  await expect(drawer.getByTestId('drawer-archived')).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('column-in_revision')).toContainText('Design system audit')
  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: /^Archive/ }).click()
  await expect(page.getByTestId('archive-empty')).toBeVisible()
})

test('Indonesian labels', async ({ page }) => {
  await page.getByRole('button', { name: 'ID', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Arsipkan Design system audit' })).toBeVisible()
  await page.getByRole('button', { name: 'Arsipkan Design system audit' }).click()
  await page.getByRole('group', { name: 'Tampilan' }).getByRole('button', { name: /^Arsip/ }).click()
  await expect(page.getByTestId('archive-row')).toContainText('Selesai · Diarsipkan')
  await expect(page.getByRole('button', { name: 'Kembalikan Design system audit' })).toBeVisible()
})
