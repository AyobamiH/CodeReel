import { expect, test } from '@playwright/test'
import { currentTime, expectNoPageErrors, openApp } from './app.js'

test.describe('Playback', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test.afterEach(async ({ page }) => {
    await expectNoPageErrors(page)
  })

  test('space pauses and resumes, R restarts', async ({ page }) => {
    // the take auto-plays on load
    await expect.poll(() => currentTime(page)).toBeGreaterThan(0)

    // Space pauses — the clock freezes
    await page.keyboard.press('Space')
    await page.waitForTimeout(250)
    const paused = await currentTime(page)
    await page.waitForTimeout(400)
    expect(await currentTime(page)).toBe(paused)

    // Space resumes — the clock advances again
    await page.keyboard.press('Space')
    await expect.poll(() => currentTime(page)).toBeGreaterThan(paused)

    // R restarts from the top
    const before = await currentTime(page)
    await page.keyboard.press('r')
    await expect.poll(() => currentTime(page)).toBeLessThan(before)
  })

  test('preview and playback bar share the same playback state', async ({ page }) => {
    const preview = page.getByRole('group', { name: 'Code preview' })
    const previewPlayback = preview.getByRole('button', { name: 'Preview playback' })
    const playbackBarToggle = page.getByTitle('Play / pause (Space)')

    await expect(previewPlayback).toHaveAttribute('aria-pressed', 'true')

    await preview.click()
    await expect(previewPlayback).toHaveAttribute('aria-pressed', 'false')

    await playbackBarToggle.click()
    await expect(previewPlayback).toHaveAttribute('aria-pressed', 'true')

    // The nested preview button owns its click; the surface must not toggle a second time.
    await previewPlayback.click()
    await expect(previewPlayback).toHaveAttribute('aria-pressed', 'false')
  })

  test('preview playback control supports keyboard activation', async ({ page }) => {
    const previewPlayback = page.getByRole('button', { name: 'Preview playback' })

    await previewPlayback.focus()
    await expect(previewPlayback).toHaveAttribute('aria-pressed', 'true')

    await page.keyboard.press('Space')
    await expect(previewPlayback).toHaveAttribute('aria-pressed', 'false')

    await page.keyboard.press('Enter')
    await expect(previewPlayback).toHaveAttribute('aria-pressed', 'true')
  })

  test('duration selector drives the total timeline length', async ({ page }) => {
    const durationSelect = page.locator('select', {
      has: page.locator('option', { hasText: '15s' }),
    })
    await durationSelect.selectOption({ label: '8s' })
    await expect(page.getByText('8.0s').last()).toBeVisible()
  })

  test('speed control reflects the active multiplier', async ({ page }) => {
    const fast = page.getByRole('button', { name: '2×' })
    await fast.click()
    await expect(fast).toHaveClass(/text-white/)
  })
})
