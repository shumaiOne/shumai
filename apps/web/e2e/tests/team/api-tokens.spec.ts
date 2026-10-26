import { createHash } from 'node:crypto'
import { expect, test } from '../../fixtures'
import { E2E_APP_URL } from '../../helpers/auth'

test('owner creates an API token that is shown once, listed by hint, and authenticates API calls', async ({
  owner,
  prisma,
  playwright,
}) => {
  const { page, teamId } = owner

  // 1. Open the API Tokens settings tab
  await page.goto(`/teams/${teamId}/settings`)
  await page.getByRole('button', { name: /^(API Tokens|API 令牌)$/i }).click()
  await expect(page.getByText(/No API tokens found|未找到 API 令牌/i)).toBeVisible()

  // 2. Generate a token
  await page.fill('#tokenName', 'e2e-cli')
  await page.getByRole('button', { name: /^(Generate|生成)$/i }).click()

  // 3. The plaintext is shown once in a dialog
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(/Save your API token|保存您的 API 令牌/i)).toBeVisible()
  const tokenInput = dialog.getByRole('textbox')
  await expect(tokenInput).toHaveValue(/^shumai_[A-Za-z0-9_-]{43}$/)
  const token = await tokenInput.inputValue()

  await dialog.getByRole('button', { name: /^(Done|完成)$/i }).click()
  await expect(dialog).toBeHidden()

  // 4. The list identifies the token by name and hint only
  const hint = token.slice(-4)
  const row = page.getByRole('row', { name: /e2e-cli/ })
  await expect(row).toBeVisible()
  await expect(row.getByText(`…${hint}`)).toBeVisible()
  await expect(page.getByText(token)).toHaveCount(0)

  // 5. Only the hash is stored
  const stored = await prisma.apiToken.findFirstOrThrow({ where: { name: 'e2e-cli' } })
  expect(stored.tokenHash).toBe(createHash('sha256').update(token, 'utf8').digest('hex'))
  expect(stored.tokenHint).toBe(hint)

  // 6. The token authenticates a request that carries no session cookie
  const tokenClient = await playwright.request.newContext({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    baseURL: E2E_APP_URL,
  })
  try {
    const ok = await tokenClient.get('/api/projects', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(ok.status()).toBe(200)

    const rejected = await tokenClient.get('/api/projects', {
      headers: { Authorization: `Bearer ${stored.tokenHash}` },
    })
    expect(rejected.status()).toBe(401)
  } finally {
    await tokenClient.dispose()
  }
})
