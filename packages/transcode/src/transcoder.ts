import { prisma } from '@shumai/db'
import { WorkflowTaskType, WorkflowTaskStatus } from '@shumai/db'
import '@shumai/db/src/prisma-json-types'

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

  setVideoResolutions(resolutions?: PrismaJson.VideoResolutionLadder[]): this {
    if (resolutions) {
      this.spec.videoResolutions = resolutions
    }
    return this
  }

  setHardwareAcceleration(hardwareAcceleration?: PrismaJson.HardwareAcceleration): this {
    if (hardwareAcceleration) {
      this.spec.hardwareAcceleration = hardwareAcceleration
    }
    return this
  }

  setThreads(threads?: number): this {
    if (threads !== undefined) {
      this.spec.threads = threads
    }
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

  setHls(enabled?: boolean, resolutions?: PrismaJson.HlsResolutionLadder[]): this {
    if (enabled !== undefined) {
      this.spec.hlsEnabled = enabled
    }
    if (resolutions) {
      this.spec.hlsResolutions = resolutions
    }
    return this
  }

  async submit(): Promise<string> {
    const task = await this.db.workflowTask.create({
      data: {
        assetId: this.assetId,
        teamId: this.teamId,
        projectId: this.projectId,
        type: WorkflowTaskType.transcode_video,
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
        type: WorkflowTaskType.transcode_image,
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

export class PdfTranscoder {
  private spec: PrismaJson.TaskSpec = {}

  constructor(
    private readonly db: TransactionClient,
    private readonly assetId: string,
    private readonly teamId: string,
    private readonly projectId: string,
  ) {}

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
        type: WorkflowTaskType.transcode_pdf,
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

export class ModelTranscoder {
  private spec: PrismaJson.TaskSpec = {}

  constructor(
    private readonly db: TransactionClient,
    private readonly assetId: string,
    private readonly teamId: string,
    private readonly projectId: string,
  ) {}

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
        type: WorkflowTaskType.transcode_3d,
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
