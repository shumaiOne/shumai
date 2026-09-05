export {}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace PrismaJson {
    export type PiSessionEntryData = Omit<
      import('@earendil-works/pi-agent-core').SessionTreeEntry,
      'id' | 'type' | 'parentId' | 'timestamp'
    >

    export type ShumaiMessageContext = import('@shumai/dtos').ShumaiMessageContext

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
      avatarPreset?: string
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
    export type HardwareAcceleration = 'off' | 'auto'

    // ----------------------------------------------------------------------
    // Collection Filter
    // ----------------------------------------------------------------------
    export type CollectionFilter = import('@shumai/dtos').CollectionFilter

    export interface TranscodeSettings {
      videoStrategy: VideoTranscodeStrategy
      hardwareAcceleration?: HardwareAcceleration
    }

    export interface MediaProviderConfig {
      apiKey?: string
    }

    export interface EnabledMediaModelConfig {
      id: string
      type: 'image' | 'video'
      provider: string
      modelId: string
      name?: string
      createdAt: string
    }

    export interface MediaGenerationSettings {
      providers?: Record<string, MediaProviderConfig>
      enabledModels?: EnabledMediaModelConfig[]
    }

    export interface Settings {
      transcode: TranscodeSettings
      mediaGeneration?: MediaGenerationSettings
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
    }

    export interface ImageTranscode {
      key?: string
      url?: string
      width: number
      height: number
      quality: number
      format: string
      isPreview?: boolean
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
      videoBitRate?: number
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
      videoPreview?: VideoTranscode
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
      autofillSource?: 'NONE' | 'CONTENT' | 'CREATION_CONTEXT'
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
      screenshot?: ScreenshotSpec
      imageAnnotation?: ImageAnnotationSpec
      pdfPages?: PdfPagesSpec
      watermark?: WatermarkTaskPayload
    }

    // ----------------------------------------------------------------------
    // Task Spec & Payload
    // ----------------------------------------------------------------------
    export interface TaskSpec {
      videoStrategy?: VideoTranscodeStrategy
      hardwareAcceleration?: HardwareAcceleration
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
      second?: number | null
      annotations?: Record<string, unknown>[]
      context?: import('@shumai/dtos').ShumaiMessageContext
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
      imageAssetKey: string
      imageAssetUrl?: string
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

    // ----------------------------------------------------------------------
    // MCP Server
    // ----------------------------------------------------------------------
    export type McpTransport = 'streamable_http' | 'sse'

    export interface McpServerAuthConfig {
      type?: 'none' | 'bearer' | 'oauth'
      bearerToken?: string
      headers?: Record<string, string>
      oauth?: {
        grantType?: 'authorization_code' | 'client_credentials'
        clientId?: string
        clientSecret?: string
        scope?: string
        authorizationParams?: Record<string, string>
        redirectUri?: string
        clientName?: string
        clientUri?: string
        skipIssuerMetadataValidation?: boolean
      }
    }

    export interface McpServerConfig {
      excludeTools?: string[]
      requestTimeoutMs?: number
      idleTimeoutMs?: number
      keepAlive?: boolean
      protocolVersion?: 'legacy' | 'auto' | '2026-07-28'
      directTools?: string[]
    }

    export interface McpToolInfo {
      name: string
      title?: string
      description?: string
      inputSchema?: unknown
    }

    export interface McpStoredTokens {
      accessToken: string
      refreshToken?: string
      expiresAt?: number // Unix timestamp in seconds
      scope?: string
      issuer?: string
    }

    export interface McpStoredClientInfo {
      clientId: string
      clientSecret?: string
      clientIdIssuedAt?: number
      clientSecretExpiresAt?: number
      redirectUris?: string[]
      issuer?: string
      configPreRegistered?: boolean
    }

    export interface McpPendingAuth {
      state: string
      authorizationUrl: string
      discovery: Record<string, unknown>
      expiresAt: number // Unix timestamp in seconds
      grantType?: 'authorization_code' | 'client_credentials'
      redirectUri?: string
    }

    // ----------------------------------------------------------------------
    // Quota Types
    // ----------------------------------------------------------------------
    export type QuotaResourceData = Record<string, unknown>
    export type QuotaUserIds = string[]

    // ----------------------------------------------------------------------
    // Kanban Types
    // ----------------------------------------------------------------------
    export type KanbanBlockReasonKind = 'NEEDS_INPUT' | 'CAPABILITY' | 'DEPENDENCY' | 'TRANSIENT'

    export interface KanbanAssetSummary {
      id: string
      type?: string
      name?: string
      description?: string
    }

    export interface KanbanEventPayload {
      summary?: string
      blockReason?: string
      blockKind?: KanbanBlockReasonKind
      assets?: KanbanAssetSummary[]
      reason?: string
      [key: string]: unknown
    }

    export interface KanbanCommentAttachment {
      id: string
      name: string
      key: string
      sizeByte: number
      contentType?: string | null
      proxyType?: 'image' | 'video' | 'audio' | 'pdf' | null
    }
    export type KanbanCommentAttachmentList = KanbanCommentAttachment[]
  }
}
