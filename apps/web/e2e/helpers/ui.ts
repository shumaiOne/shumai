import { expect, type Locator, type Page } from '@playwright/test'

export function parseTeamIdFromUrl(url: string): string {
  const match = url.match(/\/teams\/([^/]+)/)
  if (!match) throw new Error(`Could not parse teamId from URL: ${url}`)
  return match[1]
}

/** Performs the signup UI flow and waits for the redirect to the team page. */
export async function signupViaUi(page: Page, email: string, password: string): Promise<string> {
  await page.goto('/signup')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/teams\/[^/]+/)
  return parseTeamIdFromUrl(page.url())
}

/** Performs the login UI flow and waits for the redirect to the team page. */
export async function loginViaUi(page: Page, email: string, password: string): Promise<string> {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/teams\/[^/]+/)
  return parseTeamIdFromUrl(page.url())
}

/** Opens the team members dialog from the team page header. */
export async function openMembersDialog(page: Page): Promise<Locator> {
  await page.getByTestId('team-members-trigger').click()
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible()
  return dialog
}

/** Clicks "Generate Link" in the members dialog and returns the invite link. */
export async function generateInviteLink(dialog: Locator): Promise<string> {
  await dialog.getByRole('button', { name: 'Generate Link' }).click()
  const inviteInput = dialog.locator('input[readonly]')
  await expect(inviteInput).toBeVisible()
  const inviteLink = await inviteInput.inputValue()
  if (!inviteLink.includes('inviteCode=')) {
    throw new Error(`Unexpected invite link: ${inviteLink}`)
  }
  return inviteLink
}
