import type { ExportAssetMetadata, ExportCommentItem, ExportOptions, ExportResult } from '../types'
import { formatDateEdl, frameToTimecode, getEffectiveDropFrame, secondToFrame } from '../timecode'

export const exportToResolveEdl = (
  metadata: ExportAssetMetadata,
  comments: ExportCommentItem[],
  options?: ExportOptions,
): ExportResult => {
  const exportDate = options?.exportDate || new Date()
  const dropFrame = getEffectiveDropFrame(metadata.fps, metadata.startTimecode)
  const fcm = dropFrame ? 'DROP FRAME' : 'NON DROP FRAME'

  const lines: string[] = [`TITLE: ${metadata.name}`, `FCM: ${fcm}`, '']

  // Separate timestamped and non-timestamped root comments
  const timed = comments.filter((c) => c.second !== null && c.second !== undefined)
  timed.sort((a, b) => (a.second ?? 0) - (b.second ?? 0))
  const notimed = comments.filter((c) => c.second === null || c.second === undefined)

  const allSorted = [...timed, ...notimed]

  allSorted.forEach((comment, index) => {
    const eventNum = (index + 1).toString().padStart(3, '0')
    const frame =
      comment.second !== null && comment.second !== undefined
        ? secondToFrame(comment.second, metadata.fps)
        : 0
    const tc = frameToTimecode(frame, metadata.fps, dropFrame, metadata.startTimecode)

    lines.push(`${eventNum}  001  C  V  ${tc}  ${tc}  ${tc}  ${tc}`)
    lines.push(`@${comment.creator.name}, ${formatDateEdl(exportDate, false)}`)

    const markerTag = `|C:ResolveColorPurple |M:${comment.creator.name} |D:0`
    const replies = comment.replies || []

    if (replies.length === 0) {
      const msg = comment.message ? `${comment.message} ${markerTag}` : markerTag
      lines.push(msg)
    } else {
      lines.push(comment.message || '')
      replies.forEach((reply, rIndex) => {
        const isLastReply = rIndex === replies.length - 1
        lines.push(`@${reply.creator.name}, ${formatDateEdl(exportDate, true)} [Reply]`)
        const replyMsg = reply.message || ''
        if (isLastReply) {
          lines.push(`^ ${replyMsg} ${markerTag}`)
        } else {
          lines.push(`^ ${replyMsg}`)
        }
      })
    }

    lines.push('')
  })

  // EDL files standard ending
  lines.push('')
  lines.push('')

  const baseName = metadata.name.replace(/\.[^/.]+$/, '')
  return {
    content: lines.join('\n'),
    filename: `${baseName}_resolve.edl`,
    mimeType: 'text/plain; charset=utf-8',
  }
}
