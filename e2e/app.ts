import { expect, type Page } from '@playwright/test'

/** Open the app and wait for the shell to be interactive. */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByText('CodeReel', { exact: true })).toBeVisible()
}

/** The whole app is a pure function of `progress` — nothing should throw at runtime. */
export async function expectNoPageErrors(page: Page): Promise<void> {
  expect(await page.pageErrors(), 'the journey should not emit uncaught page errors').toEqual([])
}

/** The left "Code" panel. */
export function codePanel(page: Page) {
  return page.locator('aside').filter({ has: page.locator('textarea') })
}

/** Current playhead time, in seconds, read from the timeline's left-hand label. */
export async function currentTime(page: Page): Promise<number> {
  const text = (await page.locator('span.w-10.text-right').first().textContent()) ?? '0s'
  return Number(text.replace('s', '').trim())
}

/**
 * Pause the take so the WebGL preview holds a single, stable frame. The renderer
 * draws to a <canvas>, so preview assertions compare pixels (see below) rather
 * than the DOM — freezing playback first makes those comparisons deterministic.
 */
export async function pausePreview(page: Page): Promise<void> {
  // Toggle playback off via the preview's own control (aria-pressed mirrors the
  // clock). Idempotent: only clicks when it's actually playing, so callers land
  // on a paused, stable frame no matter the current state. Note: clicking the
  // preview surface itself also toggles playback, so we can't rely on a stray
  // click elsewhere to "just move focus" any more.
  const toggle = page.getByRole('button', { name: 'Preview playback' })
  if ((await toggle.getAttribute('aria-pressed')) === 'true') {
    await toggle.click()
  }
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await page.waitForTimeout(300)
}

/** A small, stable fingerprint of the current WebGL preview frame. */
export async function previewSignature(page: Page): Promise<string> {
  return page.evaluate(() => {
    const c = document.querySelector('main canvas') as HTMLCanvasElement | null
    if (!c || !c.width) return ''
    const s = document.createElement('canvas')
    s.width = 160
    s.height = 90
    s.getContext('2d')!.drawImage(c, 0, 0, s.width, s.height)
    return s.toDataURL()
  })
}

/**
 * Assert that `action` visibly changes the rendered preview. Pause first so the
 * only thing that can move the pixels is the setting under test.
 */
export async function expectPreviewChanges(page: Page, action: () => Promise<void>): Promise<void> {
  const before = await previewSignature(page)
  await action()
  await expect
    .poll(async () => (await previewSignature(page)) !== before, {
      message: 'the setting should change the rendered preview',
      timeout: 8000,
    })
    .toBe(true)
}
