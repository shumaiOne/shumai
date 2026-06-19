import type { NotificationInfo } from '@shumai/dtos'
import { formatTimeAgo } from '@/ui/lib/time'
import { cn } from '@/ui/lib/utils'
import { SpriteScrubber } from './sprite-scrubber'

interface NotificationCardProps {
  notification: NotificationInfo
}

export const NotificationCard = ({ notification }: NotificationCardProps) => {
  const { creator, createdAt, isRead, type, asset, project, team, user } = notification

  const message = (() => {
    const creatorName = creator?.name || 'Unknown User'
    const assetName = asset?.name || 'unknown asset'
    const projectName = project?.name || 'unknown project'
    const teamName = team?.name || 'unknown team'
    const targetUserName = user?.name || 'unknown user'

    switch (type) {
      case 'comment_created':
        return (
          <span>
            <span className="font-semibold">{creatorName}</span> commented on{' '}
            <span className="font-semibold">{assetName}</span>
          </span>
        )
      case 'reply_created':
        return (
          <span>
            <span className="font-semibold">{creatorName}</span> replied to a comment on{' '}
            <span className="font-semibold">{assetName}</span>
          </span>
        )
      case 'mention':
        return (
          <span>
            <span className="font-semibold">{creatorName}</span> mentioned you in{' '}
            <span className="font-semibold">{assetName}</span>
          </span>
        )
      case 'successful_file_uploaded':
        return (
          <span>
            <span className="font-semibold">{creatorName}</span> uploaded{' '}
            <span className="font-semibold">{assetName}</span> to{' '}
            <span className="font-semibold">{projectName}</span>
          </span>
        )
      case 'metadata_field_updated_status':
        return (
          <span>
            <span className="font-semibold">{creatorName}</span> updated status of{' '}
            <span className="font-semibold">{assetName}</span>
          </span>
        )
      case 'new_user_join_team':
        return (
          <span>
            <span className="font-semibold">{targetUserName}</span> joined{' '}
            <span className="font-semibold">{teamName}</span>
          </span>
        )
      case 'new_user_join_project':
        return (
          <span>
            <span className="font-semibold">{targetUserName}</span> joined{' '}
            <span className="font-semibold">{projectName}</span>
          </span>
        )
      default:
        return (
          <span>
            New notification from <span className="font-semibold">{creatorName}</span>
          </span>
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
