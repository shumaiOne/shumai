export interface ExportCommentUser {
  id: string
  name: string
  image?: string | null
  email?: string | null
  avatarColor?: string | null
}

export interface ExportCommentItem {
  id: string
  message: string | null
  second: number | null
  createdAt: Date | string
  isCompleted: boolean
  creator: ExportCommentUser
  annotations?: unknown
  replies?: ExportCommentItem[]
}

export interface ExportAssetMetadata {
  id: string
  name: string
  fps: number
  duration: number
  totalFrames: number
  startTimecode?: string | null
  width?: number
  height?: number
  rawMedia?: unknown
}

export interface ExportOptions {
  exportDate?: Date
  timeZone?: string
}

export interface ExportResult {
  content: string
  filename: string
  mimeType: string
}
