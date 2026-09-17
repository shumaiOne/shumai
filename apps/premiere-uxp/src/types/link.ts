export interface LinkedSequenceAsset {
  sequenceGuid: string
  sequenceName: string
  assetId: string
  assetName: string
  assetThumbnailUrl?: string
  endpoint?: string
  projectId?: string
  syncedCommentIds: string[]
  syncedMarkerGuids?: string[]
  lastSyncAt: number
  totalCommentsSynced: number
}
