import type { CommentInfo } from '@shumai/dtos'
import { getShumaiClient } from '../api/client'

/**
 * Fetches timecoded comments for an asset from Shumai.
 */
export async function fetchAssetComments(
  endpoint: string,
  apiKey: string,
  assetId: string,
): Promise<CommentInfo[]> {
  const client = getShumaiClient(endpoint, apiKey)
  const res = await client.api.files[':fileId'].comments.$get({
    param: { fileId: assetId },
    query: { first: '100' },
  })

  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(errData.error || `Failed to fetch comments (HTTP ${res.status})`)
  }

  const data = await res.json()
  return (data?.data as CommentInfo[]) || []
}

/**
 * Formats a Shumai comment into marker text including any threaded replies.
 */
export function formatCommentBody(comment: CommentInfo): string {
  let body = comment.message || ''

  if (comment.replies && comment.replies.length > 0) {
    body += '\n\n--- Replies ---'
    for (const reply of comment.replies) {
      const author = reply.creator?.name || 'User'
      const replyMsg = reply.message || ''
      body += `\n${author}: ${replyMsg}`
    }
  }

  return body
}
