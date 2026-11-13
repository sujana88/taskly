import { expect, test } from '@playwright/test'
import { signInAsDemo } from './helpers'

test.beforeEach(async ({ page }) => {
  await signInAsDemo(page)
  await page.goto('/#/clients')
  await expect(page.getByRole('heading', { name: 'Clients', level: 1 })).toBeVisible()
})

test('the Help button opens a guide for the current page', async ({ page }) => {
  await page.getByTestId('help-button').click()
  const panel = page.getByRole('dialog', { name: 'Help centre' })
  await expect(panel).toBeVisible()
  await expect(panel.getByTestId('quick-start').getByRole('listitem')).toHaveCount(5)
  // The Clients guide is open and marked; the others are collapsed.
  await expect(panel.getByTestId('guide-clients')).toHaveAttribute('open', '')
  await expect(panel.getByTestId('guide-clients')).toContainText('This page')
  await expect(panel.getByTestId('guide-tasks')).not.toHaveAttribute('open', '')
  await page.screenshot({ path: 'e2e-screenshots/20-help.png' })

  // A guide links to its page and closes help.
  await panel.getByTestId('guide-reports').locator('summary').click()
  await panel.getByRole('link', { name: 'Open Reports' }).click()
  await expect(panel).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Weekly report' })).toBeVisible()
})

test('terms, FAQ and shortcuts tabs, and search', async ({ page }) => {
  await page.getByTestId('help-button').click()
  const panel = page.getByRole('dialog', { name: 'Help centre' })
  await panel.getByRole('tab', { name: 'Terms' }).click()
  await expect(panel.getByTestId('glossary')).toContainText('Overlap')
  await panel.getByRole('tab', { name: 'Terms' }).press('ArrowRight')
  await expect(panel.getByRole('tab', { name: 'FAQ' })).toHaveAttribute('aria-selected', 'true')
  await panel.getByText('Where is my data stored?').click()
  await expect(panel.getByText(/In this browser only/)).toBeVisible()
  await panel.getByRole('tab', { name: 'Shortcuts' }).click()
  await expect(panel.getByTestId('shortcuts')).toContainText('Open this help centre')

  await panel.getByRole('searchbox', { name: 'Search help' }).fill('pdf')
  await expect(panel.getByTestId('help-result-count')).toContainText('for "pdf"')
  await expect(panel.getByTestId('help-hit').first()).toBeVisible()
  await panel.getByRole('searchbox', { name: 'Search help' }).fill('qwertyzz')
  await expect(panel.getByText('Nothing found. Try another word.')).toBeVisible()

  // Esc clears the search first, then closes help.
  await page.keyboard.press('Escape')
  await expect(panel.getByRole('searchbox', { name: 'Search help' })).toHaveValue('')
  await expect(panel.getByTestId('quick-start')).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
})

test('"?" opens help, but not while typing; Indonesian label', async ({ page }) => {
  await page.getByRole('button', { name: 'ID', exact: true }).click()
  await expect(page.getByTestId('help-button')).toHaveText('Bantuan')
  await page.keyboard.press('?')
  const panel = page.getByRole('dialog', { name: 'Pusat bantuan' })
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('tab', { name: 'Istilah' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Jam kerja saya' }).click()
  await page.getByRole('dialog').getByLabel('Mulai').focus()
  await page.keyboard.press('?')
  await expect(panel).toBeHidden()
})
