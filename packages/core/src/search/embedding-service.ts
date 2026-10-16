import { prisma, WorkflowTaskStatus, WorkflowTaskType } from '@shumai/db'
import { logger } from '@shumai/core/src/logger'

export interface RegenerateEmbeddingsResult {
  tasksCreated: number
  totalAssets: number
  skippedTeams: string[]
}

export class EmbeddingService {
  /**
   * Regenerates vector embeddings across all teams.
   *
   * Skips teams that do not have an active (enabled) embedding agent and logs a warning.
   * For teams with an active embedding agent, purges existing embeddings and pending/processing
   * embedding tasks upfront, then creates fresh ai_embedding workflow tasks for all eligible assets.
   */
  async regenerateEmbeddings(): Promise<RegenerateEmbeddingsResult> {
    const teams = await prisma.team.findMany({
      select: { id: true, name: true },
    })

    const activeAgents = await prisma.agent.findMany({
      where: {
        type: 'embedding',
        enabled: true,
      },
      select: { id: true, teamId: true },
    })

    const activeAgentByTeamId = new Map(
      activeAgents
        .filter((a): a is typeof a & { teamId: string } => typeof a.teamId === 'string')
        .map((a) => [a.teamId, a]),
    )

    const activeTeamIds: string[] = []
    const skippedTeams: string[] = []

    for (const team of teams) {
      if (activeAgentByTeamId.has(team.id)) {
        activeTeamIds.push(team.id)
      } else {
        skippedTeams.push(team.name || team.id)
        logger.warn(
          { teamId: team.id, teamName: team.name },
          'Skipping embedding regeneration for team: no active embedding agent found',
        )
      }
    }

    if (activeTeamIds.length === 0) {
      logger.info('No teams found with an active embedding agent. 0 tasks created.')
      return { tasksCreated: 0, totalAssets: 0, skippedTeams }
    }

    const candidateAssets = await prisma.asset.findMany({
      where: {
        isDeleted: false,
        status: 'processed',
        type: { in: ['file', 'version_stack'] },
        project: { teamId: { in: activeTeamIds } },
      },
      include: { project: true },
    })

    const eligibleAssets = candidateAssets.filter((asset) => {
      const isVideo = asset.mediaType?.startsWith('video/')
      const mediaInfo = asset.media as PrismaJson.MediaInfo | null
      const isImage =
        asset.mediaType?.startsWith('image/') ||
        (mediaInfo?.proxyType === '3d' && (mediaInfo.imageTranscodes?.length ?? 0) > 0)
      return isVideo || isImage
    })

    const eligibleAssetIds = eligibleAssets.map((a) => a.id)

    if (eligibleAssetIds.length > 0) {
      // Clean up previous embedding tasks to avoid duplicate execution
      await prisma.workflowTask.deleteMany({
        where: {
          assetId: { in: eligibleAssetIds },
          type: WorkflowTaskType.ai_embedding,
        },
      })

      // Purge existing embeddings so everything regenerates cleanly with the configured provider
      await prisma.assetEmbedding.deleteMany({
        where: {
          assetId: { in: eligibleAssetIds },
        },
      })
    }

    let tasksCreated = 0
    for (const asset of eligibleAssets) {
      const teamId = asset.project?.teamId
      if (!teamId) continue
      const agent = activeAgentByTeamId.get(teamId)
      if (!agent) continue

      await prisma.workflowTask.create({
        data: {
          assetId: asset.id,
          type: WorkflowTaskType.ai_embedding,
          status: WorkflowTaskStatus.pending,
          teamId,
          projectId: asset.projectId,
          payload: {
            projectId: asset.projectId ?? '',
            agent: { agentId: agent.id },
          },
        },
      })
      tasksCreated++
    }

    logger.info(
      {
        totalAssets: eligibleAssets.length,
        tasksCreated,
        skippedTeamsCount: skippedTeams.length,
      },
      'Successfully queued embedding regeneration tasks',
    )

    return {
      tasksCreated,
      totalAssets: eligibleAssets.length,
      skippedTeams,
    }
  }
}

export const embeddingService = new EmbeddingService()
