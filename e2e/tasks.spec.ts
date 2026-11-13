import { expect, test, type Page } from '@playwright/test'
import { signInAsDemo } from './helpers'

const shots = 'e2e-screenshots'
const column = (page: Page, s: string) => page.getByTestId(`column-${s}`)
const card = (page: Page, title: string) => page.getByTestId('task-card').filter({ hasText: title })

test.beforeEach(async ({ page }) => {
  await signInAsDemo(page)
  await page.goto('/#/tasks')
  await expect(page.getByTestId('task-card')).toHaveCount(8)
})

test('shows the board with four columns, cards and client clocks', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Tasks', level: 1 })).toBeVisible()
  for (const name of ['To-do', 'In progress', 'In revision', 'Done']) await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible()
  await expect(page.getByTestId('count-todo')).toHaveText('3')
  await expect(page.getByTestId('client-clock')).toHaveCount(4)
  // Berlin deadline is shown in both zones on the card.
  await expect(card(page, 'Hero section redesign')).toContainText('Berlin')
  await page.screenshot({ path: `${shots}/01-board.png`, fullPage: true })
})

test('search and client filter narrow the board and live in the URL', async ({ page }) => {
  await page.getByPlaceholder('Search tasks').fill('hero section')
  await expect(page.getByTestId('task-card')).toHaveCount(1)
  await expect(page).toHaveURL(/q=hero/)
  await page.getByPlaceholder('Search tasks').fill('')
  await page.getByRole('combobox', { name: 'Client' }).selectOption({ label: 'Harbour Digital' })
  await expect(page.getByTestId('task-card')).toHaveCount(2)
  await page.getByPlaceholder('Search tasks').fill('zzz')
  await expect(page.getByText('No tasks match')).toBeVisible()
  await page.screenshot({ path: `${shots}/02-empty-filter.png` })
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.getByTestId('task-card')).toHaveCount(8)
})

test('opens a task, edits it and keeps the change after reload', async ({ page }) => {
  await card(page, 'Hero section redesign').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByTestId('due-client')).toContainText('Berlin')
  await page.screenshot({ path: `${shots}/03-drawer.png` })
  const title = dialog.getByLabel('Title')
  await title.fill('Hero section redesign v2')
  await title.press('Enter')
  await dialog.getByRole('checkbox', { name: 'High-fidelity desktop version' }).click()
  await expect(dialog.getByRole('checkbox', { name: 'High-fidelity desktop version' })).toBeChecked()
  await dialog.getByPlaceholder('Add a subtask').fill('Client review call')
  await dialog.getByPlaceholder('Add a subtask').press('Enter')
  await expect(dialog.getByRole('checkbox')).toHaveCount(6)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await page.reload()
  await expect(card(page, 'Hero section redesign v2')).toContainText('4/6')
})

test('drags a card to another column with the mouse', async ({ page }) => {
  const source = card(page, 'Menu photo retouch')
  const target = column(page, 'in_revision')
  const from = (await source.boundingBox())!
  const to = (await target.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + 20)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 30, from.y + 40, { steps: 5 })
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 60, { steps: 20 })
  await page.screenshot({ path: `${shots}/04-dragging.png` })
  await page.mouse.up()
  await expect(column(page, 'in_revision').getByText('Menu photo retouch')).toBeVisible()
  await expect(page.getByTestId('count-in_revision')).toHaveText('3')
  await expect(page.getByTestId('count-todo')).toHaveText('2')
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.reload()
  await expect(column(page, 'in_revision').getByText('Menu photo retouch')).toBeVisible()
})

test('moves a card with the keyboard', async ({ page }) => {
  await card(page, 'Q1 brand moodboard').focus()
  // Real key presses are a few frames apart; dnd-kit measures between them.
  await page.keyboard.press('Space')
  await page.waitForTimeout(150)
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(150)
  await page.keyboard.press('Space')
  await expect(column(page, 'in_progress').getByText('Q1 brand moodboard')).toBeVisible()
  await expect(page.getByTestId('count-in_progress')).toHaveText('3')
  // Enter opens the focused card.
  await card(page, 'Q1 brand moodboard').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('quick add creates a card at the bottom of the column', async ({ page }) => {
  await page.getByLabel('New task in Done').fill('Send final files')
  await page.getByLabel('New task in Done').press('Enter')
  await expect(column(page, 'done').getByTestId('task-card').last()).toContainText('Send final files')
})

test('list view sorts by column header', async ({ page }) => {
  await page.getByRole('button', { name: 'List' }).click()
  const table = page.getByTestId('task-table')
  await expect(table.locator('tbody tr')).toHaveCount(8)
  await table.getByRole('button', { name: 'Task' }).click()
  await expect(table.locator('tbody tr').first()).toContainText('Delivery app icons')
  await table.getByRole('button', { name: 'Task' }).click()
  await expect(table.locator('tbody tr').first()).toContainText('Q1 brand moodboard')
  await page.screenshot({ path: `${shots}/05-list.png`, fullPage: true })
})

test('switches the interface to Indonesian', async ({ page }) => {
  await page.getByRole('button', { name: 'ID', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tugas', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dikerjakan' })).toBeVisible()
  await page.screenshot({ path: `${shots}/06-indonesian.png` })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Tugas', level: 1 })).toBeVisible()
})

test('works on a phone-sized screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: 'Tasks', level: 1 })).toBeVisible()
  await page.screenshot({ path: `${shots}/07-mobile.png`, fullPage: true })
})
