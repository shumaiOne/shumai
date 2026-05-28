export {}

import { SessionTreeEntry } from '@earendil-works/pi-agent-core'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace PrismaJson {
    // ----------------------------------------------------------------------
    // Agent Session Entry
    // ----------------------------------------------------------------------
    export type PiSessionEntry = SessionTreeEntry

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
      thinkingLevel?: string
      systemPrompt?: string
      appendSystemPrompt?: string[]
    }

    // ----------------------------------------------------------------------
    // Team Ai Settings
    // ----------------------------------------------------------------------
    export type AiProvider = 'openai' | 'google' | 'elevenlabs'

    export interface AiProviderSettings {
      apiKey?: string
      baseUrl?: string
      chatModels?: string[]
      transcribeModels?: string[]
    }

    // ----------------------------------------------------------------------
    // Team Settings
    // ----------------------------------------------------------------------
    export type VideoTranscodeStrategy = 'disable' | 'single' | 'full'

    // ----------------------------------------------------------------------
    // Collection Filter
    // ----------------------------------------------------------------------
    export type CollectionFilter = import('./dtos/collection').CollectionFilter
    export type ImageTranscodeStrategy = 'disable' | 'single'

    export interface TranscodeSettings {
      videoStrategy: VideoTranscodeStrategy
      imageStrategy: ImageTranscodeStrategy
    }

    export interface Settings {
      transcode: TranscodeSettings
      enablePublicSignup: boolean
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

    export interface MediaInfo {
      duration: number
      filesize: number
      fps: number
      frames: number
      imageTranscodes: ImageTranscode[]
      videoTranscodes: VideoTranscode[]
      videoPreview: VideoTranscode
      sprite?: SpriteInfo
      poster?: PosterInfo
      thumbnail?: ImageTranscode
      finishedAt: string
      metadata: Metadata | null
      mimeType: string
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
    }

    // ----------------------------------------------------------------------
    // System Settings Value
    // ----------------------------------------------------------------------
    export type SystemSettingsValue = unknown

    // ----------------------------------------------------------------------
    // Provider Config
    // ----------------------------------------------------------------------
    export type ModelConfig = import('zod').z.infer<
      typeof import('@/dtos/provider').providerModelConfigSchema
    >
    export type ProviderConfig = import('@/dtos/provider').ProviderConfigSerializable

    // ----------------------------------------------------------------------
    // Workflow Task Payload
    // ----------------------------------------------------------------------
    export interface WorkflowTaskPayload {
      projectId: string
      transcode?: TaskSpec
      agent?: AgentTaskPayload
    }

    // ----------------------------------------------------------------------
    // Task Spec & Payload
    // ----------------------------------------------------------------------
    export interface TaskSpec {
      videoStrategy?: VideoTranscodeStrategy
      imageStrategy?: ImageTranscodeStrategy
      thumbnail?: boolean
      sprite?: boolean
      poster?: boolean
    }

    export interface AgentTaskPayload {
      agentId?: string
      userId?: string
      sessionId?: string
      userCommentId?: string
      explicitMention?: boolean
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
    export interface SkillEnvironmentVariable {
      name: string
      default?: string
    }

    export interface SkillConfig {
      environmentVariables: SkillEnvironmentVariable[]
    }
  }
}
