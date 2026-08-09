import { expect, test } from '@playwright/test'
import { codePanel, expectNoPageErrors, openApp } from './app.js'

test.describe('Steps mode', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
    await codePanel(page).getByRole('button', { name: 'Steps' }).click()
    await expect(codePanel(page).getByText('Step 1 / 3', { exact: true })).toBeVisible()
  })

  test.afterEach(async ({ page }) => {
    await expectNoPageErrors(page)
  })

  test('editing a caption updates the playback bar caption', async ({ page }) => {
    await page.getByPlaceholder('Step caption (optional)…').fill('My first step')
    await expect(page.getByText('My first step')).toBeVisible()
  })

  test('reordering a step moves its content', async ({ page }) => {
    const panel = codePanel(page)
    // jump to step 2 ("Guard the empty case")
    await panel.getByRole('button', { name: '2', exact: true }).click()
    await expect(page.getByPlaceholder('Step caption (optional)…')).toHaveValue(
      'Guard the empty case',
    )

    await panel.getByTitle('Move left').click()
    await expect(panel.getByText('Step 1 / 3', { exact: true })).toBeVisible()
    await expect(page.getByPlaceholder('Step caption (optional)…')).toHaveValue(
      'Guard the empty case',
    )
  })

  test('per-step transition override is configurable', async ({ page }) => {
    const panel = codePanel(page)
    await panel.getByRole('button', { name: '2', exact: true }).click()

    // the per-step select is the one offering a "Default (…)" entry
    const override = page.locator('select', {
      has: page.locator('option', { hasText: 'Default (' }),
    })
    await override.selectOption({ label: 'Crossfade' })
    await expect(override).toHaveValue('crossfade')
  })

  test('the default transition is configurable', async ({ page }) => {
    const defaultTransition = page
      .locator('label', { hasText: 'Default transition' })
      .getByRole('combobox')
    await defaultTransition.selectOption({ label: 'Typewriter' })
    await expect(defaultTransition).toHaveValue('typewriter')
  })
})
