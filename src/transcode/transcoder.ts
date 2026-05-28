import { prisma } from '@/db'
import { WorkflowTaskType, WorkflowTaskStatus } from '@/generated/prisma/client'
import '@/prisma-json-types'

type TransactionClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export class VideoTranscoder {
  private spec: PrismaJson.TaskSpec = {}

  constructor(
    private readonly db: TransactionClient,
    private readonly assetId: string,
    private readonly teamId: string,
    private readonly projectId: string,
  ) {}

  setStrategy(strategy: PrismaJson.VideoTranscodeStrategy): this {
    this.spec.videoStrategy = strategy
    return this
  }

  withSprite(): this {
    this.spec.sprite = true
    return this
  }

  withPoster(): this {
    this.spec.poster = true
    return this
  }

  async submit(): Promise<string> {
    const task = await this.db.workflowTask.create({
      data: {
        assetId: this.assetId,
        teamId: this.teamId,
        projectId: this.projectId,
        type: WorkflowTaskType.transcode,
        status: WorkflowTaskStatus.pending,
        payload: {
          projectId: this.projectId,
          transcode: this.spec,
        },
      },
    })
    return task.id
  }
}

export class ImageTranscoder {
  private spec: PrismaJson.TaskSpec = {}

  constructor(
    private readonly db: TransactionClient,
    private readonly assetId: string,
    private readonly teamId: string,
    private readonly projectId: string,
  ) {}

  setStrategy(strategy: PrismaJson.ImageTranscodeStrategy): this {
    this.spec.imageStrategy = strategy
    return this
  }

  withThumbnail(): this {
    this.spec.thumbnail = true
    return this
  }

  async submit(): Promise<string> {
    const task = await this.db.workflowTask.create({
      data: {
        assetId: this.assetId,
        teamId: this.teamId,
        projectId: this.projectId,
        type: WorkflowTaskType.transcode,
        status: WorkflowTaskStatus.pending,
        payload: {
          projectId: this.projectId,
          transcode: this.spec,
        },
      },
    })
    return task.id
  }
}
