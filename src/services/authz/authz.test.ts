import { setupTestDbHooks } from '@/db-test-hooks'
import { describe, expect, it } from 'vitest'

import { prisma } from '@/db'
import { authzService, Permission, ResourceType } from '@/services/authz/authz'

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
          searchFilter: { conditions: [], operator: 'AND', recursively: true },
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
})
