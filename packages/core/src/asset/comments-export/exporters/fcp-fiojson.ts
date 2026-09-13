import type { ExportAssetMetadata, ExportCommentItem, ExportOptions, ExportResult } from '../types'
import { secondToFrame } from '../timecode'

/* eslint-disable @typescript-eslint/naming-convention */
interface FcpFioOwner {
  id: string
  name: string
  profile_image: string | null
  avatar_color: string
  image_32: string | null
  image_64: string | null
  image_128: string | null
  image_256: string | null
}

interface FcpFioComment {
  id: string
  text: string
  completed: boolean
  parent_id: string | null
  frame: number | null
  timestamp: number | null
  timestamp_microseconds: number | null
  has_replies: boolean
  annotation: string | null
  inserted_at: string
  owner: FcpFioOwner
}

export const exportToFcpFioJson = (
  metadata: ExportAssetMetadata,
  comments: ExportCommentItem[],
  options?: ExportOptions,
): ExportResult => {
  // Final Cut Pro .fiojson format uses standard ISO 8601 UTC timestamps (e.g. 2026-09-13T03:26:00.000Z)
  // for inserted_at, so timeZone options do not modify the JSON timestamp format.
  void options
  // Separate timestamped and non-timestamped comments
  const timed = comments.filter((c) => c.second !== null && c.second !== undefined)
  timed.sort((a, b) => (a.second ?? 0) - (b.second ?? 0))
  const notimed = comments.filter((c) => c.second === null || c.second === undefined)

  const allSorted = [...timed, ...notimed]

  const flattenedComments: FcpFioComment[] = []

  allSorted.forEach((comment) => {
    const isTimed = comment.second !== null && comment.second !== undefined
    const frame = isTimed ? secondToFrame(comment.second, metadata.fps) : null
    const us = isTimed ? Math.round((comment.second ?? 0) * 1_000_000) : null
    const replies = comment.replies || []

    const hasAnnotation = Boolean(
      comment.annotations &&
      (Array.isArray(comment.annotations) ? comment.annotations.length > 0 : true),
    )
    const annotationStr = hasAnnotation
      ? typeof comment.annotations === 'string'
        ? comment.annotations
        : JSON.stringify(comment.annotations)
      : null

    flattenedComments.push({
      id: comment.id,
      text: comment.message || '',
      completed: comment.isCompleted,
      parent_id: null,
      frame,
      timestamp: frame,
      timestamp_microseconds: us,
      has_replies: replies.length > 0,
      annotation: annotationStr,
      inserted_at:
        typeof comment.createdAt === 'string' ? comment.createdAt : comment.createdAt.toISOString(),
      owner: {
        id: comment.creator.id,
        name: comment.creator.name,
        profile_image: comment.creator.image || null,
        avatar_color: comment.creator.avatarColor || 'aqua',
        image_32: comment.creator.image || null,
        image_64: comment.creator.image || null,
        image_128: comment.creator.image || null,
        image_256: comment.creator.image || null,
      },
    })

    replies.forEach((r) => {
      flattenedComments.push({
        id: r.id,
        text: r.message || '',
        completed: r.isCompleted,
        parent_id: comment.id,
        frame: null,
        timestamp: null,
        timestamp_microseconds: null,
        has_replies: false,
        annotation: null,
        inserted_at: typeof r.createdAt === 'string' ? r.createdAt : r.createdAt.toISOString(),
        owner: {
          id: r.creator.id,
          name: r.creator.name,
          profile_image: r.creator.image || null,
          avatar_color: r.creator.avatarColor || 'orange',
          image_32: r.creator.image || null,
          image_64: r.creator.image || null,
          image_128: r.creator.image || null,
          image_256: r.creator.image || null,
        },
      })
    })
  })

  const output = {
    asset: {
      id: metadata.id,
      name: metadata.name,
      fps: metadata.fps,
      duration: metadata.duration,
      frames: metadata.totalFrames,
      type: 'file',
      metadata: {
        fps: metadata.fps,
        duration: metadata.duration.toString(),
        totalFrames: metadata.totalFrames,
        width: metadata.width,
        height: metadata.height,
        format_name: 'MP4',
      },
    },
    comments: flattenedComments,
  }

  const baseName = metadata.name.replace(/\.[^/.]+$/, '')
  return {
    content: JSON.stringify(output),
    filename: `${baseName}.fiojson`,
    mimeType: 'application/json; charset=utf-8',
  }
}
/* eslint-enable @typescript-eslint/naming-convention */
