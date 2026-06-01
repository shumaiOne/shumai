import { Hono } from 'hono'
import { inviteService } from '@shumai/core/src/invite/invite'
import { InviteInfo } from '@shumai/dtos'

const app = new Hono()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapToInviteInfo = (inv: any): InviteInfo => {
  const info: InviteInfo = {
    code: inv.code,
    role: inv.role!,
    teamId: inv.teamId,
    teamName: inv.team.name,
    inviterName: inv.inviter.name,
    isUsed: inv.used,
  }

  if (inv.project) {
    info.projectId = inv.project.id
    info.projectName = inv.project.name
  }

  return info
}

const route = app.get('/invite/:code', async (c) => {
  const code = c.req.param('code')
  try {
    const inv = await inviteService.getInvite(code)
    return c.json(mapToInviteInfo(inv))
  } catch {
    return c.json({ error: 'Not found' }, 404)
  }
})

export default route
