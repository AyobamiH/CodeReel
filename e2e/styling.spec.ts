import { expect, test } from '@playwright/test'
import { expectNoPageErrors, openApp } from './app.js'

test.describe('Style panel', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test.afterEach(async ({ page }) => {
    await expectNoPageErrors(page)
  })

  // the rendered code container carries the theme fg colour + font family inline
  const codeBox = (page: import('@playwright/test').Page) =>
    page.locator('main div[style*="perspective: 1400px"]')

  test('window title renders in the preview and hides with chrome', async ({ page }) => {
    const main = page.getByRole('main')
    await page.getByPlaceholder('Window title…').fill('hello.ts')
    await expect(main.getByText('hello.ts', { exact: true })).toBeVisible()

    await page.locator('label', { hasText: 'macOS chrome' }).getByRole('switch').click()
    await expect(main.getByText('hello.ts', { exact: true })).toBeHidden()
  })

  test('line numbers toggle on and off in the preview', async ({ page }) => {
    const gutter = page.getByRole('main').locator('span.select-none.tabular-nums')
    await expect(gutter.first()).toBeVisible()

    await page.locator('label', { hasText: 'Line numbers' }).getByRole('switch').click()
    await expect(gutter).toHaveCount(0)
  })

  test('changing the theme recolours the rendered code', async ({ page }) => {
    await expect(codeBox(page)).toHaveCSS('color', 'rgb(248, 248, 242)') // Dracula fg
    await page.getByRole('button', { name: 'GitHub Dark' }).click()
    await expect(codeBox(page)).toHaveCSS('color', 'rgb(230, 237, 243)') // GitHub Dark fg
  })

  test('changing the font family updates the rendered code', async ({ page }) => {
    await expect(codeBox(page)).toHaveCSS('font-family', /JetBrains Mono/)
    const fontSelect = page.locator('select', {
      has: page.locator('option', { hasText: 'Fira Code' }),
    })
    await fontSelect.selectOption({ label: 'Fira Code' })
    await expect(codeBox(page)).toHaveCSS('font-family', /Fira Code/)
  })

  test('selecting a background marks it active', async ({ page }) => {
    const ocean = page.getByTitle('Ocean')
    await ocean.click()
    await expect(ocean).toHaveClass(/ring-accent-400/)

    await page.locator('input[type="color"]').fill('#123456')
    await expect(page.getByTitle('Custom color')).toHaveClass(/ring-accent-400/)
  })
})
