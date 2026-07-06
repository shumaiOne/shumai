import type { NotificationInfo } from '@shumai/dtos'
import { formatTimeAgo } from '@/ui/lib/time'
import { cn } from '@/ui/lib/utils'
import { SpriteScrubber } from './sprite-scrubber'
import { m } from '@/ui/paraglide/messages.js'
import { getLocale } from '@/ui/paraglide/runtime.js'

interface NotificationCardProps {
  notification: NotificationInfo
}

export const NotificationCard = ({ notification }: NotificationCardProps) => {
  const { creator, createdAt, isRead, type, asset, project, team, user } = notification

  const message = (() => {
    const creatorName = creator?.name || m.unknown_user()
    const assetName = asset?.name || m.unknown_asset()
    const projectName = project?.name || m.unknown_project()
    const teamName = team?.name || m.unknown_team()
    const targetUserName = user?.name || m.unknown_user()

    const isZh = getLocale() === 'zh'
    const creatorEl = <span className="font-semibold">{creatorName}</span>
    const assetEl = <span className="font-semibold">{assetName}</span>
    const projectEl = <span className="font-semibold">{projectName}</span>
    const teamEl = <span className="font-semibold">{teamName}</span>
    const userEl = <span className="font-semibold">{targetUserName}</span>

    switch (type) {
      case 'comment_created':
        return isZh ? (
          <span>
            {creatorEl} 评论了 {assetEl}
          </span>
        ) : (
          <span>
            {creatorEl} commented on {assetEl}
          </span>
        )
      case 'reply_created':
        return isZh ? (
          <span>
            {creatorEl} 回复了 {assetEl} 上的评论
          </span>
        ) : (
          <span>
            {creatorEl} replied to a comment on {assetEl}
          </span>
        )
      case 'mention':
        return isZh ? (
          <span>
            {creatorEl} 在 {assetEl} 中提及了你
          </span>
        ) : (
          <span>
            {creatorEl} mentioned you in {assetEl}
          </span>
        )
      case 'successful_file_uploaded':
        return isZh ? (
          <span>
            {creatorEl} 将 {assetEl} 上传到 {projectEl}
          </span>
        ) : (
          <span>
            {creatorEl} uploaded {assetEl} to {projectEl}
          </span>
        )
      case 'metadata_field_updated_status':
        return isZh ? (
          <span>
            {creatorEl} 更新了 {assetEl} 的状态
          </span>
        ) : (
          <span>
            {creatorEl} updated status of {assetEl}
          </span>
        )
      case 'new_user_join_team':
        return isZh ? (
          <span>
            {userEl} 加入了 {teamEl}
          </span>
        ) : (
          <span>
            {userEl} joined {teamEl}
          </span>
        )
      case 'new_user_join_project':
        return isZh ? (
          <span>
            {userEl} 加入了 {projectEl}
          </span>
        ) : (
          <span>
            {userEl} joined {projectEl}
          </span>
        )
      default:
        return isZh ? (
          <span>来自 {creatorEl} 的新通知</span>
        ) : (
          <span>New notification from {creatorEl}</span>
        )
    }
  })()

  const isVideoWithSprite =
    asset?.mediaType?.startsWith('video/') &&
    asset.preview &&
    asset.thumbnailUrl &&
    asset.originalWidth &&
    asset.originalHeight

  const hasPreview =
    asset?.preview && (asset.mediaType?.startsWith('image') || asset.mediaType?.startsWith('video'))

  return (
    <div className="flex py-2 cursor-pointer group border border-transparent items-center justify-center">
      {/* Unread Indicator */}
      <div
        className={cn(
          'w-1.5 h-1.5 rounded-full shadow-xs',
          isRead ? 'bg-transparent' : 'bg-destructive',
        )}
      />

      <div className="flex-1 min-w-0 flex flex-col justify-center pl-2">
        <div className="text-sm text-foreground break-all leading-snug">{message}</div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {formatTimeAgo(createdAt || '')}
        </div>
      </div>

      {hasPreview && (
        <div className="w-18 h-18 ml-2 rounded-md overflow-hidden flex-shrink-0 bg-muted border border-border flex items-center justify-center mt-0.5">
          {isVideoWithSprite ? (
            <SpriteScrubber
              spriteUrl={asset.preview!}
              thumbnailUrl={asset.thumbnailUrl!}
              videoWidth={asset.originalWidth!}
              videoHeight={asset.originalHeight!}
            />
          ) : (
            <img src={asset!.preview} alt={asset!.name} className="w-full h-full object-cover" />
          )}
        </div>
      )}
    </div>
  )
}
