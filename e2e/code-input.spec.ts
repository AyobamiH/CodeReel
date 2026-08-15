import { expect, test } from '@playwright/test'
import { codePanel, expectNoPageErrors, openApp } from './app.js'

test.describe('Code input', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test.afterEach(async ({ page }) => {
    await expectNoPageErrors(page)
  })

  test('switching language swaps in that language sample', async ({ page }) => {
    // TypeScript sample by default
    await expect(page.locator('textarea').first()).toHaveValue(/Memoized fibonacci/)

    // the language selector is the only <select> offering "TypeScript"
    const languageSelect = page.locator('select', {
      has: page.locator('option', { hasText: 'TypeScript' }),
    })
    await languageSelect.selectOption({ label: 'Python' })

    await expect(languageSelect).toHaveValue('python')
    await expect(page.locator('textarea').first()).toHaveValue(/def quicksort/)
  })

  test('uploads a source file and detects its language', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles({
      name: 'snippet.py',
      mimeType: 'text/x-python',
      buffer: Buffer.from("print('hello from upload')\n"),
    })

    await expect(page.getByText('Imported snippet.py as Python.', { exact: true })).toBeVisible()
    await expect(
      page.locator('select', { has: page.locator('option', { hasText: 'TypeScript' }) }),
    ).toHaveValue('python')
    await expect(page.locator('textarea').first()).toHaveValue(/hello from upload/)
  })

  test('accepts a plain-text file even when the language is unknown', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('just some plain notes'),
    })

    await expect(
      page.getByText('Imported notes.txt; language detection was unavailable.', { exact: true }),
    ).toBeVisible()
    await expect(page.locator('textarea').first()).toHaveValue('just some plain notes')
  })

  test('reset restores the language sample', async ({ page }) => {
    const editor = page.locator('textarea').first()
    await editor.fill('const scratch = true')
    await expect(editor).toHaveValue('const scratch = true')

    await codePanel(page).getByRole('button', { name: 'Reset sample' }).click()
    await expect(editor).toHaveValue(/Memoized fibonacci/)
  })
})
