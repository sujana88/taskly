import { expect, test } from '@playwright/test'
import { signInAsDemo, startClockAt } from './helpers'

test.beforeEach(async ({ page }) => {
  await startClockAt(page, '2026-11-12T09:02:00Z')
  await signInAsDemo(page)
  await page.goto('/#/tasks')
})

test('a task gets a Low / Medium / High priority label, shown at the top right of its card', async ({ page }) => {
  const card = (title: string) => page.getByTestId('task-card').filter({ hasText: title })
  await expect(card('Hero section redesign').getByTestId('priority-pill')).toHaveCount(0)

  await card('Hero section redesign').click()
  const picker = page.getByRole('dialog').getByTestId('priority-picker')
  await expect(picker.getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true')
  await picker.getByRole('radio', { name: 'High' }).click()
  await expect(picker.getByRole('radio', { name: 'High' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('dialog').screenshot({ path: 'e2e-screenshots/80-label-picker.png' })
  await page.keyboard.press('Escape')

  for (const [title, label] of [['Menu photo retouch', 'Low'], ['Pricing page v2', 'Medium']] as const) {
    await card(title).click()
    await page.getByRole('dialog').getByTestId('priority-picker').getByRole('radio', { name: label }).click()
    await page.keyboard.press('Escape')
  }

  const pill = card('Hero section redesign').getByTestId('priority-pill')
  await expect(pill).toHaveText('High')
  // Red for High, orange for Low, blue for Medium.
  await expect(pill).toHaveClass(/bg-red-600/)
  await expect(card('Menu photo retouch').getByTestId('priority-pill')).toHaveClass(/bg-orange-500/)
  await expect(card('Pricing page v2').getByTestId('priority-pill')).toHaveClass(/bg-blue-600/)
  // Top right: the pill's right edge lines up with the card's padding.
  const c = (await card('Hero section redesign').boundingBox())!
  const p = (await pill.boundingBox())!
  expect(c.x + c.width - (p.x + p.width)).toBeLessThan(24)
  expect(p.y - c.y).toBeLessThan(24)
  await page.screenshot({ path: 'e2e-screenshots/81-label-board.png' })

  // Saved, listed, translated, and removable.
  await page.reload()
  await expect(card('Hero section redesign').getByTestId('priority-pill')).toHaveText('High')
  await page.getByRole('button', { name: 'List', exact: true }).click()
  await expect(page.getByTestId('task-table').getByTestId('priority-pill')).toHaveCount(3)
  await page.getByRole('button', { name: 'ID', exact: true }).first().click()
  await expect(page.getByTestId('task-table').getByTestId('priority-pill').first()).toHaveText(/Tinggi|Rendah|Sedang/)
  await page.getByRole('button', { name: 'Kanban' }).click()
  await card('Hero section redesign').click()
  await page.getByRole('dialog').getByTestId('priority-picker').getByRole('radio', { name: 'Tanpa' }).click()
  await page.keyboard.press('Escape')
  await expect(card('Hero section redesign').getByTestId('priority-pill')).toHaveCount(0)
})
