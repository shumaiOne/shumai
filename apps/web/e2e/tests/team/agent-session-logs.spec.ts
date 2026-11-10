import { expect, test } from '../../fixtures'

test('session logs stay within the dialog and scroll through long messages and expanded records', async ({
  owner,
  prisma,
}) => {
  const { page, teamId, email } = owner
  const user = await prisma.user.findUniqueOrThrow({ where: { email } })
  const agentUser = await prisma.user.create({
    data: { name: 'Session Logs Agent', email: 'session-logs@shumai.test', type: 'agent' },
  })
  const agent = await prisma.agent.create({
    data: {
      id: agentUser.id,
      teamId,
      type: 'chat',
      enabled: false,
      config: { provider: 'test', model: 'test' },
    },
  })
  const session = await prisma.agentSession.create({
    data: {
      agentId: agent.id,
      userId: user.id,
      type: 'chat',
      name: 'Scrollable Session Logs',
      cwd: '/test',
    },
  })
  await prisma.agentSessionCommit.create({
    data: {
      sessionId: session.id,
      seq: 1n,
      data: {
        version: 1,
        writes: [
          { type: 'conversation', value: { id: 1 } },
          ...Array.from({ length: 30 }, (_, index) => ({
            type: 'entry',
            value: {
              id: index + 2,
              conversationId: 1,
              kind: 'pi.user',
              model: [
                {
                  role: 'user',
                  content: `Log message ${index + 1}\n\n\`\`\`text\n${'unbroken_output_'.repeat(100)}\n\`\`\``,
                  timestamp: Date.now(),
                },
              ],
              data: { output: 'raw_output_'.repeat(100) },
            },
          })),
        ],
      },
    },
  })

  await page.goto(`/teams/${teamId}/dashboard`)
  await page.getByRole('button', { name: /^(Sessions|会话)$/ }).click()
  await page.getByRole('row').filter({ hasText: session.name! }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Log message 1', { exact: true })).toBeVisible()
  const viewport = dialog.locator('[data-slot="scroll-area-viewport"]')
  const heading = dialog.getByRole('heading')

  for (const size of [
    { width: 1280, height: 800 },
    { width: 390, height: 640 },
  ]) {
    await page.setViewportSize(size)
    await dialog.evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished))
    })
    await expect
      .poll(async () => {
        return dialog.evaluate((element) => {
          const bounds = element.getBoundingClientRect()
          return (
            bounds.top >= 0 &&
            bounds.bottom <= window.innerHeight &&
            bounds.left >= 0 &&
            bounds.right <= window.innerWidth
          )
        })
      })
      .toBe(true)
    await expect
      .poll(() =>
        viewport.evaluate(
          (element) =>
            element.clientHeight > 0 &&
            element.scrollHeight > element.clientHeight &&
            element.scrollWidth <= element.clientWidth,
        ),
      )
      .toBe(true)
    const headerTop = (await heading.boundingBox())!.y
    await viewport.evaluate((element) => {
      element.scrollTop = 0
    })
    await viewport.hover()
    await page.mouse.wheel(0, 100_000)
    const record = dialog.locator('details').last()
    await expect(record.locator('summary')).toBeInViewport()
    expect(await viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    expect((await heading.boundingBox())!.y).toBeCloseTo(headerTop, 0)

    await record.locator('summary').click()
    await viewport.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect(record.locator('pre')).toBeInViewport()
    expect(await viewport.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    )
    await record.locator('summary').click()
  }
})
