import { test, expect, _electron as electron } from '@playwright/test'
import path from 'path'

let app: Awaited<ReturnType<typeof electron.launch>>
let window: Awaited<ReturnType<typeof app.firstWindow>>

test.beforeAll(async () => {
  app = await electron.launch({
    args: [path.resolve('dist-electron/electron/main.js')],
  })
  window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app?.close()
})

test.describe('App launch', () => {
  test('window opens and shows title', async () => {
    const title = await window.title()
    expect(title).toBeTruthy()
  })

  test('sidebar is visible', async () => {
    await expect(window.locator('text=STACKWATCH')).toBeVisible({ timeout: 10000 })
  })

  test('dashboard panel is default', async () => {
    await expect(window.locator('[data-testid="nav-services"]')).toBeVisible()
    await expect(window.locator('[data-testid="nav-flow"]')).toBeVisible()
  })
})

test.describe('Navigation', () => {
  test('can switch to services panel', async () => {
    await window.locator('[data-testid="nav-services"]').click()
    await expect(window.locator('text=Services')).toBeVisible()
  })

  test('can switch to dependencies panel', async () => {
    await window.locator('[data-testid="nav-dependencies"]').click()
    await expect(window.locator('text=Dependencies')).toBeVisible()
  })

  test('can switch to flow graph panel', async () => {
    await window.locator('[data-testid="nav-flow"]').click()
    await expect(window.locator('.react-flow')).toBeVisible({ timeout: 5000 })
  })
})
