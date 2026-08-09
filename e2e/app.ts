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
