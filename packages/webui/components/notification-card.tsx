import type { NotificationInfo } from '@shumai/dtos'
import { formatTimeAgo } from '@/ui/lib/time'
import { cn } from '@/ui/lib/utils'
import { SpriteScrubber } from './sprite-scrubber'
import { m } from '@/ui/paraglide/messages.js'
import React from 'react'

interface NotificationCardProps {
  notification: NotificationInfo
}

const renderNotification = (
  messageTemplate: string,
  placeholders: Record<string, React.ReactNode>,
) => {
  const regex = new RegExp(
    `(${Object.keys(placeholders)
      .map((k) => `\\{${k}\\}`)
      .join('|')})`,
    'g',
  )
  return (
    <span>
      {messageTemplate.split(regex).map((part, index) => {
        const match = part.match(/^\{(.+)\}$/)
        if (match && placeholders[match[1]]) {
          return <React.Fragment key={index}>{placeholders[match[1]]}</React.Fragment>
        }
        return part
      })}
    </span>
  )
}

export const NotificationCard = ({ notification }: NotificationCardProps) => {
  const { creator, createdAt, isRead, type, asset, project, team, user } = notification

  const message = (() => {
    const creatorName = creator?.name || m.unknown_user()
    const assetName = asset?.name || m.unknown_asset()
    const projectName = project?.name || m.unknown_project()
    const teamName = team?.name || m.unknown_team()
    const targetUserName = user?.name || m.unknown_user()

    const placeholders = {
      creator: <span className="font-semibold">{creatorName}</span>,
      asset: <span className="font-semibold">{assetName}</span>,
      project: <span className="font-semibold">{projectName}</span>,
      team: <span className="font-semibold">{teamName}</span>,
      user: <span className="font-semibold">{targetUserName}</span>,
    }

    switch (type) {
      case 'comment_created':
        return renderNotification(
          m.notification_commented_on({ creator: '{creator}', asset: '{asset}' }),
          placeholders,
        )
      case 'reply_created':
        return renderNotification(
          m.notification_replied_to({ creator: '{creator}', asset: '{asset}' }),
          placeholders,
        )
      case 'mention':
        return renderNotification(
          m.notification_mentioned_you({ creator: '{creator}', asset: '{asset}' }),
          placeholders,
        )
      case 'successful_file_uploaded':
        return renderNotification(
          m.notification_uploaded({ creator: '{creator}', asset: '{asset}', project: '{project}' }),
          placeholders,
        )
      case 'metadata_field_updated_status':
        return renderNotification(
          m.notification_status_updated({ creator: '{creator}', asset: '{asset}' }),
          placeholders,
        )
      case 'new_user_join_team':
        return renderNotification(
          m.notification_joined_team({ user: '{user}', team: '{team}' }),
          placeholders,
        )
      case 'new_user_join_project':
        return renderNotification(
          m.notification_joined_project({ user: '{user}', project: '{project}' }),
          placeholders,
        )
      default:
        return renderNotification(m.notification_generic({ creator: '{creator}' }), placeholders)
    }
  })()

  const isVideoWithSprite =
    asset?.proxyType === 'video' &&
    asset.preview &&
    asset.thumbnailUrl &&
    asset.originalWidth &&
    asset.originalHeight

  const hasPreview = asset?.preview && (asset.proxyType === 'image' || asset.proxyType === 'video')

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
