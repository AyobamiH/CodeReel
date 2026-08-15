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

  test('changing the theme recolours the rendered preview', async ({ page }) => {
    // The preview draws to a WebGL <canvas>, so a theme swap shows up as pixels,
    // not DOM colour — compare frame signatures. Covers the newest theme too.
    await pausePreview(page)
    await expectPreviewChanges(page, () =>
      page.getByRole('button', { name: 'GitHub Dark' }).click(),
    )
    await expectPreviewChanges(page, () =>
      page.getByRole('button', { name: 'Catppuccin Mocha' }).click(),
    )
    await expectPreviewChanges(page, () => page.getByRole('button', { name: 'Vaporwave' }).click())
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

    // The custom background is now driven by a portalled ColorPicker popover
    // (no native <input type="color">). Open it and change a channel; that sets
    // `customBg`, which marks the swatch active.
    const custom = page.getByTitle('Custom color')
    await custom.click()
    await page.getByRole('spinbutton').first().fill('18')
    await expect(custom).toHaveClass(/ring-accent-400/)
  })
})
