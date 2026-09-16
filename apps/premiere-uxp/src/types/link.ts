export interface LinkedSequenceAsset {
  sequenceGuid: string
  sequenceName: string
  assetId: string
  assetName: string
  assetThumbnailUrl?: string
  projectId?: string
  syncedCommentIds: string[]
  syncedMarkerGuids?: string[]
  lastSyncAt: number
  totalCommentsSynced: number
}
