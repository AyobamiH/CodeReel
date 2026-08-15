import { expect, test } from '@playwright/test'
import { expectNoPageErrors, expectPreviewChanges, openApp, pausePreview } from './app.js'

test.describe('Style panel', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test.afterEach(async ({ page }) => {
    await expectNoPageErrors(page)
  })

  test('window title + chrome toggle change the rendered preview', async ({ page }) => {
    await pausePreview(page)
    await expectPreviewChanges(page, () => page.getByPlaceholder('Window title…').fill('hello.ts'))
    await expectPreviewChanges(page, () =>
      page.locator('label', { hasText: 'macOS chrome' }).getByRole('switch').click(),
    )
  })

  test('line numbers toggle changes the rendered preview', async ({ page }) => {
    await pausePreview(page)
    await expectPreviewChanges(page, () =>
      page.locator('label', { hasText: 'Line numbers' }).getByRole('switch').click(),
    )
  })

  test('changing the theme recolours the rendered code', async ({ page }) => {
    await expect(codeBox(page)).toHaveCSS('color', 'rgb(248, 248, 242)') // Dracula fg
    await page.getByRole('button', { name: 'GitHub Dark' }).click()
    await expect(codeBox(page)).toHaveCSS('color', 'rgb(230, 237, 243)') // GitHub Dark fg
    await page.getByRole('button', { name: 'Catppuccin Mocha' }).click()
    await expect(codeBox(page)).toHaveCSS('color', 'rgb(205, 214, 244)') // Catppuccin Mocha text
  })

  test('the font family is selectable', async ({ page }) => {
    // the font feeds the WebGL card texture; the selected value is the stable
    // source of truth (whether a webfont renders differently is font-load dependent)
    const fontSelect = page.locator('select', {
      has: page.locator('option', { hasText: 'Fira Code' }),
    })
    await fontSelect.selectOption({ label: 'Fira Code' })
    await expect(fontSelect).toHaveValue('fira')
  })

  test('selecting a background marks it active', async ({ page }) => {
    const ocean = page.getByTitle('Ocean')
    await ocean.click()
    await expect(ocean).toHaveClass(/ring-accent-400/)

    await page.locator('input[type="color"]').fill('#123456')
    await expect(page.getByTitle('Custom color')).toHaveClass(/ring-accent-400/)
  })
})
