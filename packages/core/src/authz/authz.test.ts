import { setupTestDbHooks } from '@shumai/db/test'
import { describe, expect, it } from 'vitest'

import { prisma } from '@shumai/db'
import { authzService, Permission, ResourceType } from '@shumai/core/src/authz/authz'

describe('AuthzService', () => {
  setupTestDbHooks()

  it('should test authorization permissions correctly', async () => {
    // Setup Data
    // Users
    const userOwner = await prisma.user.create({
      data: { name: 'owner', email: 'owner@example.com', password: 'pass' },
    })
    const userEditor = await prisma.user.create({
      data: { name: 'editor', email: 'editor@example.com', password: 'pass' },
    })
    const userReviewer = await prisma.user.create({
      data: { name: 'reviewer', email: 'reviewer@example.com', password: 'pass' },
    })
    const userOther = await prisma.user.create({
      data: { name: 'other', email: 'other@example.com', password: 'pass' },
    })

    // Team
    const team = await prisma.team.create({
      data: { name: 'Team A' },
    })

    // Memberships
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: userOwner.id, role: 'owner' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: userEditor.id, role: 'editor' },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, userId: userReviewer.id, role: 'reviewer' },
    })

    // Project & Asset
    const project = await prisma.project.create({
      data: { name: 'Project A', teamId: team.id },
    })
    const asset = await prisma.asset.create({
      data: {
        name: 'File A',
        projectId: project.id,
        type: 'file',
        status: 'processed',
      },
    })

    // Collection
    const collection = await prisma.collection.create({
      data: {
        name: 'Collection A',
        projectId: project.id,
        filter: {
          sourceFolderId: 'root',
          searchFilter: { conditions: [], operator: 'AND', recursively: true, isSemantic: false },
        },
      },
    })

    // Project Scope User
    const userProjectEditor = await prisma.user.create({
      data: { name: 'p_editor', email: 'p_editor@example.com', password: 'pass' },
    })
    const tmPe = await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: userProjectEditor.id,
        role: 'reviewer',
        scope: 'project',
      },
    })
    await prisma.projectMember.create({
      data: { projectId: project.id, teamMemberId: tmPe.id, role: 'editor' },
    })

    const tests = [
      {
        name: 'Owner can Admin Project',
        req: {
          type: ResourceType.Project,
          id: project.id,
          user: userOwner,
          permission: Permission.Admin,
        },
        wantErr: false,
      },
      {
        name: 'Editor cannot Admin Project',
        req: {
          type: ResourceType.Project,
          id: project.id,
          user: userEditor,
          permission: Permission.Admin,
        },
        wantErr: true,
      },
      {
        name: 'Editor can Edit Project',
        req: {
          type: ResourceType.Project,
          id: project.id,
          user: userEditor,
          permission: Permission.Edit,
        },
        wantErr: false,
      },
      {
        name: 'Reviewer cannot Edit Project',
        req: {
          type: ResourceType.Project,
          id: project.id,
          user: userReviewer,
          permission: Permission.Edit,
        },
        wantErr: true,
      },
      {
        name: 'Reviewer can Read Project',
        req: {
          type: ResourceType.Project,
          id: project.id,
          user: userReviewer,
          permission: Permission.Read,
        },
        wantErr: false,
      },
      {
        name: 'Non-member cannot Read Project',
        req: {
          type: ResourceType.Project,
          id: project.id,
          user: userOther,
          permission: Permission.Read,
        },
        wantErr: true,
        errMessage: 'is not a member of the team',
      },
      {
        name: 'Project Editor can Edit Project',
        req: {
          type: ResourceType.Project,
          id: project.id,
          user: userProjectEditor,
          permission: Permission.Edit,
        },
        wantErr: false,
      },
      {
        name: 'Project Editor cannot Admin Project',
        req: {
          type: ResourceType.Project,
          id: project.id,
          user: userProjectEditor,
          permission: Permission.Admin,
        },
        wantErr: true,
      },
      {
        name: 'Project Scope User can Read Team',
        req: {
          type: ResourceType.Team,
          id: team.id,
          user: userProjectEditor,
          permission: Permission.Read,
        },
        wantErr: false,
      },
      {
        name: 'Project Scope User cannot Edit Team',
        req: {
          type: ResourceType.Team,
          id: team.id,
          user: userProjectEditor,
          permission: Permission.Edit,
        },
        wantErr: true,
        errMessage: 'User has only project scope',
      },
      {
        name: 'Resolve Context from Asset',
        req: {
          type: ResourceType.Asset,
          id: asset.id,
          user: userOwner,
          permission: Permission.Edit,
        },
        wantErr: false,
      },
      {
        name: 'Resolve Context from Collection',
        req: {
          type: ResourceType.Collection,
          id: collection.id,
          user: userOwner,
          permission: Permission.Edit,
        },
        wantErr: false,
      },
      {
        name: 'Asset Not Found',
        req: {
          type: ResourceType.Asset,
          id: '01HJXXW6A61234567890ABCDEF',
          user: userOwner,
          permission: Permission.Read,
        },
        wantErr: true,
        errMessage: 'Asset not found',
      },
    ]

    for (const tt of tests) {
      if (tt.wantErr) {
        let err
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await authzService.hasPermission(tt.req as any)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          err = e
        }
        expect(err, tt.name).toBeDefined()
        if (tt.errMessage) {
          expect(err.message).include(tt.errMessage)
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await expect(authzService.hasPermission(tt.req as any), tt.name).resolves.toBeUndefined()
      }
    }
  })

  it('should resolve context correctly for each ResourceType', async () => {
    // Setup complete data graph for all types
    const team = await prisma.team.create({ data: { name: 'Team X' } })
    const project = await prisma.project.create({ data: { name: 'Project X', teamId: team.id } })

    // Asset (Project-scoped)
    const assetProject = await prisma.asset.create({
      data: { name: 'Asset P', projectId: project.id, type: 'file', status: 'processed' },
    })

    // Asset (Team-scoped root folder fallback)
    const assetTeam = await prisma.asset.create({
      data: { name: 'Team Root', type: 'root', status: 'processed' },
    })
    await prisma.team.update({
      where: { id: team.id },
      data: { rootFolderId: assetTeam.id },
    })

    // Collection
    const collection = await prisma.collection.create({
      data: {
        name: 'Coll',
        projectId: project.id,
        filter: {
          sourceFolderId: 'root',
          searchFilter: { conditions: [], operator: 'AND', recursively: true, isSemantic: false },
        },
      },
    })

    // Agent & Session
    const user = await prisma.user.create({
      data: { name: 'BotUser2', email: 'bot2@example.com', password: 'p' },
    })
    const agent = await prisma.agent.create({
      data: {
        id: user.id,
        teamId: team.id,
        type: 'chat',
        enabled: true,
        config: { provider: 'openai', model: 'gpt-4o' },
      },
    })
    const agentSession = await prisma.agentSession.create({
      data: { agentId: agent.id, cwd: '/tmp' },
    })

    // Share
    const share = await prisma.shareLink.create({
      data: { name: 'Share1', rootFolderId: assetProject.id, projectId: project.id },
    })

    // Metadata Field
    const teamField = await prisma.metadataField.create({
      data: {
        key: 'field_t',
        scope: 'TEAM',
        teamId: team.id,
        config: { name: 'Field T', type: 'text' },
      },
    })
    const projectField = await prisma.metadataField.create({
      data: {
        key: 'field_p',
        scope: 'PROJECT',
        projectId: project.id,
        config: { name: 'Field P', type: 'text' },
      },
    })

    // Skill
    const skill = await prisma.skill.create({
      data: { name: 'Skill 1', teamId: team.id, hash: '123', assetId: assetProject.id },
    })

    // Provider
    const provider = await prisma.provider.create({
      data: { name: 'Prov 1', teamId: team.id, config: { api: 'openai-completions' } },
    })

    // Invite
    const inviteTeam = await prisma.invite.create({
      data: { code: 'inv_t', teamId: team.id, role: 'editor', inviterId: user.id },
    })
    const inviteProject = await prisma.invite.create({
      data: {
        code: 'inv_p',
        teamId: team.id,
        projectId: project.id,
        role: 'editor',
        inviterId: user.id,
      },
    })

    // Comment
    const comment = await prisma.assetComment.create({
      data: { assetId: assetProject.id, creatorId: user.id, message: 'hello' },
    })

    // Test execution via cast
    const resolveContext = (type: ResourceType, id: string) =>
      (
        authzService as unknown as {
          resolveContext: (
            type: ResourceType,
            id: string,
          ) => Promise<{ teamId: string; projectId?: string }>
        }
      ).resolveContext(type, id)

    // Tests
    await expect(resolveContext(ResourceType.Team, team.id)).resolves.toEqual({ teamId: team.id })
    await expect(resolveContext(ResourceType.Project, project.id)).resolves.toEqual({
      teamId: team.id,
      projectId: project.id,
    })
    await expect(resolveContext(ResourceType.Asset, assetProject.id)).resolves.toEqual({
      teamId: team.id,
      projectId: project.id,
    })
    await expect(resolveContext(ResourceType.Asset, assetTeam.id)).resolves.toEqual({
      teamId: team.id,
    })
    await expect(resolveContext(ResourceType.Collection, collection.id)).resolves.toEqual({
      teamId: team.id,
      projectId: project.id,
    })
    await expect(resolveContext(ResourceType.Agent, agent.id)).resolves.toEqual({ teamId: team.id })
    await expect(resolveContext(ResourceType.AgentSession, agentSession.id)).resolves.toEqual({
      teamId: team.id,
    })
    await expect(resolveContext(ResourceType.Share, share.id)).resolves.toEqual({
      teamId: team.id,
      projectId: project.id,
    })
    await expect(resolveContext(ResourceType.MetadataField, teamField.key)).resolves.toEqual({
      teamId: team.id,
    })
    await expect(resolveContext(ResourceType.MetadataField, projectField.key)).resolves.toEqual({
      teamId: team.id,
      projectId: project.id,
    })
    await expect(resolveContext(ResourceType.Skill, skill.id)).resolves.toEqual({ teamId: team.id })
    await expect(resolveContext(ResourceType.Provider, provider.id)).resolves.toEqual({
      teamId: team.id,
    })
    await expect(resolveContext(ResourceType.Invite, inviteTeam.id)).resolves.toEqual({
      teamId: team.id,
      projectId: undefined,
    })
    await expect(resolveContext(ResourceType.Invite, inviteProject.id)).resolves.toEqual({
      teamId: team.id,
      projectId: project.id,
    })
    await expect(resolveContext(ResourceType.Comment, comment.id)).resolves.toEqual({
      teamId: team.id,
      projectId: project.id,
    })
  })

  describe('New project-precedent authz rules', () => {
    it('should prioritize project-specific role over team role', async () => {
      const user = await prisma.user.create({
        data: { name: 'Matt', email: 'matt@example.com', password: 'pass' },
      })
      const team = await prisma.team.create({ data: { name: 'Team Precedence' } })
      const project = await prisma.project.create({
        data: { name: 'Project Foo', teamId: team.id },
      })

      // Matt is a team editor (which would normally give Edit permissions)
      const tm = await prisma.teamMember.create({
        data: { teamId: team.id, userId: user.id, role: 'editor', scope: 'team' },
      })

      // But Matt is specifically added to Project Foo as a reviewer (Read-only)
      await prisma.projectMember.create({
        data: { projectId: project.id, teamMemberId: tm.id, role: 'reviewer' },
      })

      // Check that Matt has Read permission on Project Foo
      await expect(
        authzService.hasPermission({
          type: ResourceType.Project,
          id: project.id,
          user,
          permission: Permission.Read,
        }),
      ).resolves.toBeUndefined()

      // Check that Matt is DENIED Edit permission on Project Foo (even though they are team editor)
      await expect(
        authzService.hasPermission({
          type: ResourceType.Project,
          id: project.id,
          user,
          permission: Permission.Edit,
        }),
      ).rejects.toThrow()
    })

    it('should fall back to team role if no project-specific role exists', async () => {
      const user = await prisma.user.create({
        data: { name: 'Jane', email: 'jane@example.com', password: 'pass' },
      })
      const team = await prisma.team.create({ data: { name: 'Team Fallback' } })
      const project = await prisma.project.create({
        data: { name: 'Project Bar', teamId: team.id },
      })

      // Jane is a team editor (scope: team)
      await prisma.teamMember.create({
        data: { teamId: team.id, userId: user.id, role: 'editor', scope: 'team' },
      })

      // Jane has no project-specific record on Project Bar, should fall back to team role (editor)
      await expect(
        authzService.hasPermission({
          type: ResourceType.Project,
          id: project.id,
          user,
          permission: Permission.Edit,
        }),
      ).resolves.toBeUndefined()
    })

    it('should deny project-scoped user access to projects they are not member of', async () => {
      const user = await prisma.user.create({
        data: { name: 'Guest', email: 'guest@example.com', password: 'pass' },
      })
      const team = await prisma.team.create({ data: { name: 'Team Guest' } })
      const projectA = await prisma.project.create({ data: { name: 'Project A', teamId: team.id } })
      const projectB = await prisma.project.create({ data: { name: 'Project B', teamId: team.id } })

      // Guest is project-scoped
      const tm = await prisma.teamMember.create({
        data: { teamId: team.id, userId: user.id, role: 'reviewer', scope: 'project' },
      })

      // Guest is only added to Project A (as editor)
      await prisma.projectMember.create({
        data: { projectId: projectA.id, teamMemberId: tm.id, role: 'editor' },
      })

      // Guest can access Project A
      await expect(
        authzService.hasPermission({
          type: ResourceType.Project,
          id: projectA.id,
          user,
          permission: Permission.Edit,
        }),
      ).resolves.toBeUndefined()

      // Guest CANNOT access Project B (denied)
      await expect(
        authzService.hasPermission({
          type: ResourceType.Project,
          id: projectB.id,
          user,
          permission: Permission.Read,
        }),
      ).rejects.toThrow('User has only project scope')
    })
  })
})
