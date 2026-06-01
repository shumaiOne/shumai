import { prisma } from '@shumai/db'
import { Prisma } from '@/generated/prisma/client'
import { s3Service } from '@/services/s3/s3'
import { paginateQuery, PaginatedData } from '@/services/pagination'
import {
  ServiceCreateProjectRequest,
  ServiceUpdateProjectRequest,
  ServiceListProjectsRequest,
  ServiceAddProjectMemberRequest,
  ServiceListProjectMembersRequest,
  ProjectInfo,
  ProjectUserInfo,
} from '@shumai/dtos'

export class ProjectService {
  async createProject(
    user: { id: string },
    req: ServiceCreateProjectRequest,
  ): Promise<ProjectInfo> {
    const team = await prisma.team.findUnique({ where: { id: req.teamId } })
    if (!team) throw new Error('Team not found')

    const teamMember = await prisma.teamMember.findUnique({
      where: {
        teamIdUserId: { teamId: req.teamId, userId: user.id },
      },
    })
    if (!teamMember) throw new Error('creator is not a team member')

    const project = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.create({
        data: {
          name: req.name,
          teamId: req.teamId,
          enableNotification: req.enableNotification ?? true,
          coverImageKey: req.coverImageKey,
        },
      })

      const rootFolder = await tx.asset.create({
        data: {
          name: 'root',
          type: 'root',
          status: 'processed',
          projectId: proj.id,
        },
      })

      const shareRootFolder = await tx.asset.create({
        data: {
          name: 'share_root',
          type: 'share_root',
          status: 'processed',
          projectId: proj.id,
        },
      })

      const updatedProj = await tx.project.update({
        where: { id: proj.id },
        data: {
          rootFolderId: rootFolder.id,
          shareRootId: shareRootFolder.id,
        },
        include: { rootFolder: true },
      })

      await tx.projectMember.create({
        data: {
          projectId: proj.id,
          teamMemberId: teamMember.id,
          role: 'owner',
        },
      })

      return updatedProj
    })

    return this.toProjectInfo(project)
  }

  async getProject(projectId: string): Promise<ProjectInfo> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { rootFolder: true },
    })
    if (!project) throw new Error('Project not found')
    return this.toProjectInfo(project)
  }

  async updateProject(req: ServiceUpdateProjectRequest): Promise<ProjectInfo> {
    const project = await prisma.project.findUnique({
      where: { id: req.projectId },
      include: { team: true },
    })
    if (!project) throw new Error('Project not found')
    if (!project.team) throw new Error('Project has no team')

    const updatedProject = await prisma.project.update({
      where: { id: req.projectId },
      data: {
        name: req.name,
        coverImageKey: req.coverImageKey,
        enableNotification: req.enableNotification,
      },
      include: { rootFolder: true },
    })

    return this.toProjectInfo(updatedProject)
  }

  async listProjects(req: ServiceListProjectsRequest): Promise<PaginatedData<ProjectInfo[]>> {
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        teamIdUserId: { teamId: req.teamId, userId: req.userId },
      },
    })
    if (!teamMember) throw new Error('failed to get team member')

    const where: Prisma.ProjectWhereInput = {
      teamId: req.teamId,
    }

    if (teamMember.scope === 'project') {
      where.members = {
        some: { teamMemberId: teamMember.id },
      }
    }

    const orderBy: Prisma.ProjectOrderByWithRelationInput = {}
    const direction = req.sortDirection === 'desc' ? 'desc' : 'asc'
    if (req.sortBy) {
      if (req.sortBy === 'created_at') {
        orderBy.createdAt = direction
      } else if (req.sortBy === 'updated_at') {
        orderBy.updatedAt = direction
      } else {
        orderBy.name = direction
      }
    } else {
      orderBy.name = 'asc'
    }

    const res = await paginateQuery(
      async (skip, take) => {
        const projects = await prisma.project.findMany({
          where,
          orderBy,
          skip,
          take,
          include: { rootFolder: true },
        })
        const infos = await Promise.all(projects.map((p) => this.toProjectInfo(p)))
        return infos
      },
      null,
      req.pagination,
    )
    return res
  }

  async addProjectMember(req: ServiceAddProjectMemberRequest): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (!user) throw new Error('User not found')

    const project = await prisma.project.findUnique({
      where: { id: req.projectId },
      include: { team: true },
    })
    if (!project) throw new Error('Project not found')

    const tm = await prisma.teamMember.findUnique({
      where: {
        teamIdUserId: { teamId: project.teamId, userId: req.userId },
      },
    })
    if (!tm) throw new Error('user is not a team member')

    await prisma.projectMember.create({
      data: {
        projectId: req.projectId,
        teamMemberId: tm.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: req.role as any,
      },
    })
  }

  async listProjectMembers(req: ServiceListProjectMembersRequest): Promise<ProjectUserInfo[]> {
    const members = await prisma.projectMember.findMany({
      where: {
        projectId: req.projectId,
        ...(req.includeAgents
          ? {
              teamMember: {
                user: {
                  OR: [
                    { type: 'human' },
                    {
                      type: 'agent',
                      agent: {
                        type: 'chat',
                        enabled: true,
                      },
                    },
                  ],
                },
              },
            }
          : { teamMember: { user: { type: { not: 'agent' } } } }),
      },
      include: {
        teamMember: {
          include: { user: true },
        },
      },
    })

    return members
      .filter((pm) => pm.teamMember && pm.teamMember.user)
      .map((pm) => ({
        id: pm.teamMember.user.id,
        name: pm.teamMember.user.name,
        role: pm.role,
      }))
  }

  async deleteProject(projectId: string): Promise<void> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })
    if (!project) throw new Error('Project not found')

    const immediateCleanupDate = new Date(0)

    await prisma.$transaction(async (tx) => {
      // 1. Mark ALL project assets as isDeleted and detach projectId
      // We keep parentId intact so the folder structure remains for Stage 1 cleanup.
      await tx.asset.updateMany({
        where: { projectId },
        data: {
          isDeleted: true,
          projectId: null,
        },
      })

      // 2. Mark root folders as 'trashed' with deletedAt = 0 to trigger immediate background purge
      const rootIds = [project.rootFolderId, project.shareRootId].filter(
        (id): id is string => id !== null,
      )
      if (rootIds.length > 0) {
        await tx.asset.updateMany({
          where: { id: { in: rootIds } },
          data: {
            status: 'trashed',
            deletedAt: immediateCleanupDate,
          },
        })
      }

      // 3. Unlink root folders from project record to avoid FK cycles during project deletion
      await tx.project.update({
        where: { id: projectId },
        data: { rootFolderId: null, shareRootId: null },
      })

      // 4. Delete the project itself
      // Cascade deletes will handle project members, invites, notifications, etc.
      await tx.project.delete({
        where: { id: projectId },
      })
    })

    // Synchronously delete the project's cover image if it exists
    if (project.coverImageKey) {
      const bucket = process.env.S3_BUCKET || 'shumai'
      try {
        await s3Service.deleteObject(bucket, project.coverImageKey)
      } catch (e: unknown) {
        console.error(`Failed to delete project cover image ${project.coverImageKey}:`, e)
      }
    }
  }

  async getProjectRootFolder(projectId: string): Promise<string> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { rootFolder: true },
    })
    if (!project) throw new Error('Project not found')
    if (!project.rootFolderId) return ''
    return project.rootFolderId
  }

  async getProjectTeam(projectId: string): Promise<string> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })
    if (!project) throw new Error('Project not found')
    return project.teamId
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async toProjectInfo(p: any): Promise<ProjectInfo> {
    const pi: ProjectInfo = {
      id: p.id,
      name: p.name,
      enableNotification: p.enableNotification ?? true,
      coverImageKey: p.coverImageKey || undefined,
      updatedAt: p.updatedAt,
    }

    if (p.rootFolderId) {
      pi.rootFolder = p.rootFolderId
    } else if (p.rootFolder) {
      pi.rootFolder = p.rootFolder.id
    }

    if (p.coverImageKey) {
      try {
        const bucket = process.env.S3_BUCKET || 'shumai'
        const url = await s3Service.presign(bucket, p.coverImageKey, 'GET')
        pi.coverImage = url
      } catch (e: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const ignored = e
      }
    }
    return pi
  }
}

export const projectService = new ProjectService()
