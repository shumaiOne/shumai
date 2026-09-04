import { describe, expect, it } from 'vitest'
import { prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { migrateLegacyAgentAvatars } from './migration'

describe('migrateLegacyAgentAvatars', () => {
  setupTestDbHooks()

  it('returns 0 when no legacy agents exist', async () => {
    const result = await migrateLegacyAgentAvatars(prisma)
    expect(result).toEqual({ migrated: 0, errors: 0 })
  })

  it('migrates legacy agent base64 avatars to S3', async () => {
    const legacyBase64 =
      'data:image/webp;base64,UklGRtInAABXRUJQVlA4IMYnAACwmACdASosASwBPm0ylUekIyIhp1L7UIANiWVu3P6nGjxxkZZTIvmXwJRUeg/Jf+ndPZ0L4H6mVI3YJ/D/tH5j9vT9C/6f3AP1d/Xz+79l/zDfsj6yP+59R39j/y/sAf3r/VdZ36EXly+0Z+6/peaqTMC4q/u/7z45+fr5VuB3l+xvUg7u/5f+G9tH9D3q/Lv/a9Qj25/vvGH2lFyP2J9gX3F+8f9H1AfzfM/+G/0nsBfrb/0PZDvp/yf/H9gP+nf4j9lPeL/2PKX+yf8H2F/6D1Of3o9pv9uzXj2UCILxSqTJtnLrjF0IFB27Vo5QPaRJKEf73CFDiYb46kQh9ZimTAfOlbMytbJDx1VHoVO115vAHuMthHxJoOL/D/OOWk7DrZTEtbvTiXzvmXoZSFox8u7pVGZ4TmovMKAMAZtbdgS8p6MNEYUl2x4pPMe0bPqCNISczDauiMeOe/Bgos4oXilTgIe/4FB/KBRUIV0FiVRnmPndzO7QLVRnyoYI+oKPA/heN/n2wfElNcnOExdS6iaO/IIjkYWljnuIe8akKIWAkomDcGMr2fPIiNFXCNFxgRCTPFdGc+T/b2dMMLNdN3KjGjeGMzQe4UURLfl5oiFEw5Pu5y0fFhDnYhvS7Ezpsb54rvwP+ycBblMc5VRkMxpWgi7zlkUUOIzcsp8rJvOWHryMg36mIXa1xMNyp2rhlY3Vgul9+8VfT412zRHaz12VW/qh9l67/CDtCsnUBGO/e8J1mT9RAmfZTCKX+ecvAjhxyIeUEAg5olYzZSkgLNrAf+HFBHtihqoNZNUgRB+NKEfWCXPqAmsILE+/Ap/wD2FlHj0Q1Qk8PrAN9C/fyX/qgkJyQGu9cAmoYwicMlikN4oRxsA6WckScktHrWfdZYT6WV2xwpPXzy/IJL7TEXpY+W9Lwn/I3P8+q9N+d895Qu4TZMfUfou353e8Wn2UzcHQsKMI7fIZiW7QHhpYTgN41QTiY3CdoGpCOjBJ7cGZrYCpm3XGz2+FBkc1si2VAiuYI/4iWRjeO/MM28I+Qr93kQ+fpnyeMMsvk845A7+37z9M5b/IfOo2z+AywfCalW3nlFXyjVqphG4zq1Xe+FQmMjC8S8JNRMUDEfQnkEcCL/+cd6RkDsj4HAwG6VD3D23XacpKJf4/D1B/f+0v/cJrVvKEknKLNw1nz2gX7HKcAWB0Z+QZDp7Y2FkMAG17AnNVYSAqW7/xgalH6qTLexWRu6LYJVIdLLlriLzZOZlqvIXvawsT1GexNoi/OPUEgSlmUbNHEFe+NtoSuKzV0DgE0k3NXU8Fjjc/oeJL0J+XplQFqXhYg+r4yDOGN7h7xxyUm7IeUiDRLK9MkyQ7b+tRIUVg6pxhKRwj0r34SPFDlMWxhsfO/fYmq/5FbsACkYPysdQAjJzNqbbmX5A7OyZ0Y85gjBVDNHWMZswj7HJVofro0VpmGWUdzLSs/aBF0o2xNxcUdxqeqUFURISYHaX8Jx0ONcwIGQH3EperfP7ZiOxEKrot1BjTcWvYQ4LD4XkTAa+16dp5x4svp1Pp8/U5IGXD+WZAhpxIA+JaP16povKRq9O4hiZQyExaNml6lrO0G/olTvRSc9nq/PybXAw5uYhRIvclmBM27AAA='

    const agentUser = await prisma.user.create({
      data: {
        name: 'Legacy Agent',
        email: `legacy-${Date.now()}@shumai.ai`,
        type: 'agent',
        image: legacyBase64,
      },
    })

    const humanUser = await prisma.user.create({
      data: {
        name: 'Human User',
        email: `human-${Date.now()}@shumai.ai`,
        type: 'human',
        image: legacyBase64,
      },
    })

    const modernAgentUser = await prisma.user.create({
      data: {
        name: 'Modern Agent',
        email: `modern-${Date.now()}@shumai.ai`,
        type: 'agent',
        image: 'files/existing-key.webp',
      },
    })

    const result = await migrateLegacyAgentAvatars(prisma)
    expect(result).toEqual({ migrated: 1, errors: 0 })

    const updatedAgent = await prisma.user.findUnique({
      where: { id: agentUser.id },
    })
    expect(updatedAgent?.image).toMatch(/^files\/[A-Z0-9]{26}\.webp$/)

    const updatedHuman = await prisma.user.findUnique({
      where: { id: humanUser.id },
    })
    expect(updatedHuman?.image).toBe(legacyBase64)

    const updatedModern = await prisma.user.findUnique({
      where: { id: modernAgentUser.id },
    })
    expect(updatedModern?.image).toBe('files/existing-key.webp')
  })
})
