export {}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace PrismaJson {
    export type PiSessionEntryData = Omit<
      import('@earendil-works/pi-agent-core').SessionTreeEntry,
      'id' | 'type' | 'parentId' | 'timestamp'
    >

    // ----------------------------------------------------------------------
    // User Agent Settings
    // ----------------------------------------------------------------------
    export interface AgentSettings {
      role: string
      provider: string
      model: string
      thinkingLevel: string
      enableWebSearch: boolean
    }

    // ----------------------------------------------------------------------
    // Agent Config
    // ----------------------------------------------------------------------
    export interface AgentConfig {
      provider: string
      model: string
      thinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
      systemPrompt?: string
      appendSystemPrompt?: string[]
      deniedTools?: string[]
    }

    // ----------------------------------------------------------------------
    // Team Ai Settings
    // ----------------------------------------------------------------------
    export type AiProvider = 'openai' | 'google' | 'elevenlabs'

    export interface AiProviderSettings {
      apiKey?: string
      baseUrl?: string
      chatModels?: string[]
    }

    // ----------------------------------------------------------------------
    // Team Settings
    // ----------------------------------------------------------------------
    export type VideoTranscodeStrategy = 'best_match' | 'all'

    // ----------------------------------------------------------------------
    // Collection Filter
    // ----------------------------------------------------------------------
    export type CollectionFilter = import('@shumai/dtos').CollectionFilter

    export interface TranscodeSettings {
      videoStrategy: VideoTranscodeStrategy
    }

    export interface Settings {
      transcode: TranscodeSettings
    }

    // ----------------------------------------------------------------------
    // Project Metadata Overrides
    // ----------------------------------------------------------------------
    export type MetadataOverrides = Record<string, unknown>

    // ----------------------------------------------------------------------
    // Asset Media Info
    // ----------------------------------------------------------------------
    export interface VideoTranscode {
      key?: string
      url?: string
      width: number
      height: number
      resolution?: string
      isRaw?: boolean
    }

    export interface ImageTranscode {
      key?: string
      url?: string
      width: number
      height: number
      quality: number
      format: string
      isRaw?: boolean
    }

    export interface SpriteInfo {
      frames: number
      tileX: number
      tileY: number
      key: string
    }

    export interface PosterInfo {
      key: string
    }

    export interface Metadata {
      originalHeight: number
      originalWidth: number
      hasAudio: boolean
      duration: number
      bitRate: number
      frameRate: number
      totalFrames: number
      startTimecode: string
      videoCodec?: string
      audioCodec?: string
      audioChannels?: number
      audioSampleRate?: number
      audioBitDepth?: number
      format: unknown
    }

    export interface OriginalInfo {
      key: string
      downloadUrl: string
      filesizeInBytes: number
      codec: string
    }

    export interface PdfTranscode {
      key?: string
      url?: string
    }

    export interface MediaInfo {
      duration: number
      filesize: number
      frames: number
      proxyType?: 'image' | 'video' | 'audio' | 'pdf'
      imageTranscodes: ImageTranscode[]
      videoTranscodes: VideoTranscode[]
      videoPreview: VideoTranscode
      pdfTranscode?: PdfTranscode
      sprite?: SpriteInfo
      poster?: PosterInfo
      thumbnail?: ImageTranscode
      finishedAt: string
      metadata: Metadata | null
      original: OriginalInfo | null
    }

    // ----------------------------------------------------------------------
    // Share Link Field Visibility
    // ----------------------------------------------------------------------
    export type ShareLinkFieldVisibility = Record<string, boolean>

    // ----------------------------------------------------------------------
    // Asset Metadata Data
    // ----------------------------------------------------------------------
    export type AssetMetadataData = Record<string, unknown>

    // ----------------------------------------------------------------------
    // Asset Comment Annotation
    // ----------------------------------------------------------------------
    export type AnnotationType = 'arrow' | 'line' | 'box' | 'freehand'

    export interface Annotation {
      type: AnnotationType
      color: string
      points: number[][]
    }

    export type AnnotationList = Annotation[]

    // ----------------------------------------------------------------------
    // Metadata Field Config
    // ----------------------------------------------------------------------
    export type FieldType =
      | 'text'
      | 'longText'
      | 'select'
      | 'selectMulti'
      | 'rating'
      | 'number'
      | 'toggle'
      | 'date'
      | 'user'
      | 'userMulti'

    export interface SelectOption {
      id: string
      displayName: string
      color: string
    }

    export type TextConfig = Record<string, never>
    export type LongTextConfig = Record<string, never>

    export interface SelectConfig {
      options: SelectOption[]
    }

    export interface SelectMultiConfig {
      options: SelectOption[]
    }

    export interface RatingConfig {
      maxValue: number // 2-6
    }

    export interface NumberConfig {
      scale: number // 0-3 decimal places
    }

    export type ToggleConfig = Record<string, never>

    export interface DateConfig {
      displayFormat: string // 'local' | 'friendly' | 'usa' | 'euro' | 'iso'
      displayTimezone: boolean
      includeTime: boolean
      timeFormat: string // 'twelve_hour' | 'twenty_four_hour'
    }

    export type UserConfig = Record<string, never>
    export type UserMultiConfig = Record<string, never>

    export interface FieldConfig {
      name: string
      type: FieldType
      text?: TextConfig
      longText?: LongTextConfig
      select?: SelectConfig
      selectMulti?: SelectMultiConfig
      rating?: RatingConfig
      number?: NumberConfig
      toggle?: ToggleConfig
      date?: DateConfig
      user?: UserConfig
      userMulti?: UserMultiConfig
    }

    // ----------------------------------------------------------------------
    // System Settings Value
    // ----------------------------------------------------------------------
    export type SystemSettingsValue = unknown

    // ----------------------------------------------------------------------
    // Provider Config
    // ----------------------------------------------------------------------
    export type ModelConfig = import('zod').z.infer<
      typeof import('@shumai/dtos').providerModelConfigSchema
    >
    export type ProviderConfig = import('@shumai/dtos').ProviderConfigSerializable

    export interface ScreenshotSpec {
      start: number
      end: number
      count: number
      commentTimestamp?: number | null
      annotations?: AnnotationList | null
    }

    export interface ImageAnnotationSpec {
      annotations?: AnnotationList | null
    }

    export interface PdfPagesSpec {
      start: number
      end: number
      commentTimestamp?: number | null
      annotations?: AnnotationList | null
    }

    export interface WorkflowTaskPayload {
      projectId: string
      transcode?: TaskSpec
      agent?: AgentTaskPayload
      queryEmbeddingForSearch?: {
        text: string
      }
      agentToolCall?: AgentToolCallPayload
      screenshot?: ScreenshotSpec
      imageAnnotation?: ImageAnnotationSpec
      pdfPages?: PdfPagesSpec
      watermark?: WatermarkTaskPayload
    }

    // ----------------------------------------------------------------------
    // Task Spec & Payload
    // ----------------------------------------------------------------------
    export interface AgentToolCallPayload {
      toolName: string
      args: Record<string, unknown>
      userId: string
    }

    export interface TaskSpec {
      videoStrategy?: VideoTranscodeStrategy
      thumbnail?: boolean
      sprite?: boolean
      poster?: boolean
    }

    export interface AgentTaskPayload {
      agentId?: string
      userId?: string
      sessionId?: string
      userCommentId?: string
      prompt?: string
      imageUrls?: string[]
      attachedFiles?: string[]
      assetIds?: string[]
      isNewChat?: boolean
      hasAssetChanged?: boolean
    }

    // ----------------------------------------------------------------------
    // User Metadata Value
    // ----------------------------------------------------------------------
    // This is a generic metadata store that can hold any JSON-serializable value.
    // We use any here because the structure of the metadata is determined by the
    // keys used by different parts of the application.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export type UserMetadataValue = any

    // ----------------------------------------------------------------------
    // Skill Config
    // ----------------------------------------------------------------------
    export type SkillEnvironmentVariable = import('@shumai/dtos').SkillEnvironmentVariable
    export type SkillConfig = import('@shumai/dtos').SkillConfig

    // ----------------------------------------------------------------------
    // Watermark Config
    // ----------------------------------------------------------------------
    export interface WatermarkBlockText {
      id: string
      type: 'text'
      x: number
      y: number
      opacity: number
      rotation: number
      text: string
      size: number
      color: string
    }

    export interface WatermarkBlockImage {
      id: string
      type: 'image'
      x: number
      y: number
      opacity: number
      rotation: number
      imageAssetId: string
      size: number
    }

    export type WatermarkBlock = WatermarkBlockText | WatermarkBlockImage

    export interface WatermarkConfigSpec {
      blocks: WatermarkBlock[]
    }

    export interface WatermarkTaskPayload {
      watermarkConfigId: string
      shareLinkId?: string
    }
  }
}
