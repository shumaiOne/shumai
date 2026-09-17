import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchAssetComments, formatCommentBody } from './commentUtils'
import * as clientModule from '../api/client'
import type { CommentInfo } from '@shumai/dtos'

describe('commentUtils', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('fetchAssetComments', () => {
    it('returns comments array when response is ok', async () => {
      const mockComments: Partial<CommentInfo>[] = [
        { id: 'c1', message: 'First comment', second: 12 },
        { id: 'c2', message: 'Second comment', second: 45 },
      ]

      const mockGet = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockComments }),
      })

      vi.spyOn(clientModule, 'getShumaiClient').mockReturnValue({
        api: {
          files: {
            ':fileId': {
              comments: {
                $get: mockGet,
              },
            },
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const result = await fetchAssetComments('https://api.shumai.test', 'test-key', 'asset-1')

      expect(mockGet).toHaveBeenCalledWith({
        param: { fileId: 'asset-1' },
        query: { first: '100' },
      })
      expect(result).toEqual(mockComments)
    })

    it('throws error with message from server response when res.ok is false', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Asset not found on this server' }),
      })

      vi.spyOn(clientModule, 'getShumaiClient').mockReturnValue({
        api: {
          files: {
            ':fileId': {
              comments: {
                $get: mockGet,
              },
            },
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      await expect(
        fetchAssetComments('https://api.shumai.test', 'test-key', 'asset-missing'),
      ).rejects.toThrow('Asset not found on this server')
    })

    it('throws fallback HTTP status error when res.ok is false and response has no error field', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      })

      vi.spyOn(clientModule, 'getShumaiClient').mockReturnValue({
        api: {
          files: {
            ':fileId': {
              comments: {
                $get: mockGet,
              },
            },
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      await expect(
        fetchAssetComments('https://api.shumai.test', 'test-key', 'asset-crash'),
      ).rejects.toThrow('Failed to fetch comments (HTTP 500)')
    })
  })

  describe('formatCommentBody', () => {
    it('formats single comment without replies', () => {
      const comment = {
        message: 'Review cut at 01:23',
        replies: [],
      } as unknown as CommentInfo

      expect(formatCommentBody(comment)).toBe('Review cut at 01:23')
    })

    it('formats comment with nested replies and authors', () => {
      const comment = {
        message: 'Needs color correction',
        replies: [
          { creator: { name: 'Alice' }, message: 'Applied LUT' },
          { creator: { name: 'Bob' }, message: 'Looks better' },
        ],
      } as unknown as CommentInfo

      const result = formatCommentBody(comment)
      expect(result).toContain('Needs color correction')
      expect(result).toContain('--- Replies ---')
      expect(result).toContain('Alice: Applied LUT')
      expect(result).toContain('Bob: Looks better')
    })
  })
})
