import { expect, test } from '@playwright/test'
import { signInAsDemo, startClockAt } from './helpers'

test.beforeEach(async ({ page }) => {
  await startClockAt(page, '2026-11-12T09:02:00Z')
  await signInAsDemo(page)
  await page.goto('/#/tasks')
})

test('marks a finished task as delivered, and restores it to Done', async ({ page }) => {
  const done = page.getByTestId('column-done')
  const card = done.getByTestId('task-card').filter({ hasText: 'Design system audit' })
  // Delivered sits to the left of Archive on the card.
  const deliver = card.getByTestId('card-deliver')
  const archive = card.getByTestId('card-archive')
  await expect(deliver).toHaveText('Delivered')
  expect((await deliver.boundingBox())!.x).toBeLessThan((await archive.boundingBox())!.x)
  await card.screenshot({ path: 'e2e-screenshots/83-card-delivered.png' })

  await deliver.click()
  await expect(done.getByTestId('task-card')).toHaveCount(0)
  const tabs = page.getByRole('group', { name: 'View' })
  // The Delivered tab comes right after Archive.
  await expect(tabs.getByRole('button')).toHaveText(['Kanban', 'List', 'Calendar', 'Cancelled', 'Archive', 'Delivered1'])
  await tabs.getByRole('button', { name: /^Delivered/ }).click()
  const row = page.getByTestId('delivered-row')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Design system audit')
  await expect(row).toContainText('Done · Delivered')
  await page.screenshot({ path: 'e2e-screenshots/84-delivered-view.png' })

  // Archive and Delivered are separate lists.
  await tabs.getByRole('button', { name: /^Archive/ }).click()
  await expect(page.getByTestId('archive-empty')).toBeVisible()

  await tabs.getByRole('button', { name: /^Delivered/ }).click()
  await row.getByRole('button', { name: 'Design system audit', exact: true }).click()
  await expect(page.getByTestId('drawer-delivered')).toContainText('Delivered to the client on')
  await page.getByTestId('drawer-delivered').getByRole('button', { name: 'Restore' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('delivered-empty')).toBeVisible()
  await page.reload()
  await tabs.getByRole('button', { name: 'Kanban' }).click()
  await expect(done.getByTestId('task-card')).toHaveCount(1)
})

test('Indonesian: Terkirim', async ({ page }) => {
  await page.getByRole('button', { name: 'ID', exact: true }).first().click()
  await page.getByRole('button', { name: 'Tandai terkirim: Design system audit' }).click()
  await page.getByRole('group', { name: 'Tampilan' }).getByRole('button', { name: /^Terkirim/ }).click()
  await expect(page.getByTestId('delivered-row')).toContainText('Selesai · Terkirim')
})
