import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatCommentBody, syncCommentsToSequence } from './markers'
import type { Project, Sequence } from '@adobe/premierepro'
import type { CommentInfo } from '@shumai/dtos'
import type { LinkedSequenceAsset } from '../types/link'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true,
})

describe('markers service', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    // Reset global require
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).require
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window
  })

  describe('formatCommentBody', () => {
    it('formats simple comment without replies', () => {
      const comment: Partial<CommentInfo> = {
        message: 'This is a test comment',
        replies: [],
      }
      expect(formatCommentBody(comment as CommentInfo)).toBe('This is a test comment')
    })

    it('appends formatted replies beneath message', () => {
      const comment: Partial<CommentInfo> = {
        message: 'Original cut feedback',
        replies: [
          {
            creator: { id: 'u2', name: 'Alice' },
            message: 'Fixed in v2',
          } as unknown as CommentInfo,
          {
            creator: { id: 'u3', name: 'Bob' },
            message: 'Looks great now',
          } as unknown as CommentInfo,
        ],
      }
      const formatted = formatCommentBody(comment as CommentInfo)
      expect(formatted).toContain('Original cut feedback')
      expect(formatted).toContain('--- Replies ---')
      expect(formatted).toContain('Alice: Fixed in v2')
      expect(formatted).toContain('Bob: Looks great now')
    })
  })

  describe('syncCommentsToSequence', () => {
    const existingLink: LinkedSequenceAsset = {
      sequenceGuid: 'seq-guid-1',
      sequenceName: 'Seq 1',
      assetId: 'asset-1',
      assetName: 'test.mp4',
      syncedCommentIds: ['comm-1'],
      lastSyncAt: 1000,
      totalCommentsSynced: 1,
    }

    it('returns without creating markers if no new comments exist', async () => {
      const comments: Partial<CommentInfo>[] = [
        { id: 'comm-1', second: 10, message: 'Already synced' },
      ]

      const mockProject = {
        guid: 'proj-1',
        lockedAccess: vi.fn(),
        executeTransaction: vi.fn(),
      }
      const mockSeq = { guid: 'seq-guid-1' }

      const result = await syncCommentsToSequence(
        mockProject as unknown as Project,
        mockSeq as unknown as Sequence,
        comments as CommentInfo[],
        existingLink,
      )

      expect(result.addedCount).toBe(0)
      expect(result.updatedLink.syncedCommentIds).toEqual(['comm-1'])
      expect(mockProject.executeTransaction).not.toHaveBeenCalled()
    })

    it('creates markers for new comments, placing non-timestamped comments at time 0 (zeroPoint)', async () => {
      const mockCompoundAction = { addAction: vi.fn() }
      let callCount = 0
      const mockSeqMarkers = {
        getMarkers: vi.fn().mockImplementation(() => {
          callCount++
          if (callCount === 1) {
            return [{ guid: 'old-guid-1' }]
          }
          return [{ guid: 'old-guid-1' }, { guid: 'marker-guid-2' }, { guid: 'marker-guid-3' }]
        }),
        createAddMarkerAction: vi.fn().mockImplementation((name, type, time, dur, comment) => {
          return { name, type, time, dur, comment }
        }),
      }

      const mockPpro = {
        Marker: { MARKER_TYPE_COMMENT: 'CommentMarkerType' },
        Markers: {
          getMarkers: vi.fn().mockResolvedValue(mockSeqMarkers),
        },
        TickTime: {
          TIME_ZERO: { ticks: '0' },
          createWithSeconds: vi.fn((sec) => ({ seconds: sec })),
        },
        Properties: {
          getProperties: vi.fn().mockResolvedValue({
            createSetValueAction: vi.fn().mockReturnValue({}),
          }),
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).window = {
        require: vi.fn().mockImplementation((name: string) => {
          if (name === 'premierepro') return mockPpro
          return null
        }),
      }

      const comments: Partial<CommentInfo>[] = [
        { id: 'comm-1', second: 10, message: 'Already synced' },
        {
          id: 'comm-2',
          second: 15.5,
          message: 'New timestamped comment',
          creator: { id: 'u1', name: 'Director' } as unknown as CommentInfo['creator'],
          replies: [],
        },
        {
          id: 'comm-3',
          second: null,
          message: 'General comment without timestamp',
          creator: { id: 'u2', name: 'Producer' } as unknown as CommentInfo['creator'],
          replies: [],
        },
      ]

      const mockProject = {
        guid: 'proj-1',
        lockedAccess: vi.fn((cb) => cb()),
        executeTransaction: vi.fn((cb) => {
          cb(mockCompoundAction)
          return true
        }),
      }
      const mockSeq = {
        guid: 'seq-guid-1',
        getZeroPoint: vi.fn().mockResolvedValue({ seconds: 3600 }), // 1hr timecode start
      }

      const result = await syncCommentsToSequence(
        mockProject as unknown as Project,
        mockSeq as unknown as Sequence,
        comments as CommentInfo[],
        existingLink,
      )

      expect(result.addedCount).toBe(2)
      expect(result.updatedLink.syncedCommentIds).toEqual(['comm-1', 'comm-2', 'comm-3'])
      expect(result.updatedLink.syncedMarkerGuids).toEqual(['marker-guid-2', 'marker-guid-3'])
      expect(result.updatedLink.totalCommentsSynced).toBe(3)

      // Time should be offset by zeroPoint (3600 + 15.5 = 3615.5 for comm-2, 3600 + 0 = 3600 for comm-3)
      expect(mockPpro.TickTime.createWithSeconds).toHaveBeenCalledWith(3615.5)
      expect(mockPpro.TickTime.createWithSeconds).toHaveBeenCalledWith(3600)
      expect(mockSeqMarkers.createAddMarkerAction).toHaveBeenCalledWith(
        'Director',
        'CommentMarkerType',
        { seconds: 3615.5 },
        mockPpro.TickTime.TIME_ZERO,
        'New timestamped comment',
      )
      expect(mockSeqMarkers.createAddMarkerAction).toHaveBeenCalledWith(
        'Producer',
        'CommentMarkerType',
        { seconds: 3600 },
        mockPpro.TickTime.TIME_ZERO,
        'General comment without timestamp',
      )
      expect(mockSeqMarkers.createAddMarkerAction).toHaveBeenCalledTimes(2)
      expect(mockCompoundAction.addAction).toHaveBeenCalled()
    })

    it('backfills missing marker GUIDs from sequence when syncedMarkerGuids is incomplete', async () => {
      const existingLink: LinkedSequenceAsset = {
        sequenceGuid: 'seq-guid-1',
        sequenceName: 'Sequence 01',
        assetId: 'asset-1',
        assetName: 'video.mp4',
        syncedCommentIds: ['comm-1'],
        syncedMarkerGuids: [], // missing GUIDs from previous sync
        totalCommentsSynced: 1,
        lastSyncAt: 1000,
      }

      const mockLegacyMarker = {
        guid: '{LEGACY-MARKER-GUID-1}',
        getName: () => 'Director',
        getComments: () => 'Existing comment message',
      }

      const mockSeqMarkers = {
        getMarkers: vi.fn().mockReturnValue([mockLegacyMarker]),
        createAddMarkerAction: vi.fn(),
      }

      const mockPpro = {
        Marker: { MARKER_TYPE_COMMENT: 'CommentMarkerType' },
        Markers: {
          getMarkers: vi.fn().mockResolvedValue(mockSeqMarkers),
        },
        TickTime: {
          TIME_ZERO: { ticks: '0' },
          createWithSeconds: vi.fn((sec) => ({ seconds: sec })),
        },
        Properties: {
          getProperties: vi.fn().mockResolvedValue({
            createSetValueAction: vi.fn().mockReturnValue({}),
          }),
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).window = {
        require: vi.fn().mockImplementation((name: string) => {
          if (name === 'premierepro') return mockPpro
          return null
        }),
      }

      const comments: Partial<CommentInfo>[] = [
        {
          id: 'comm-1',
          second: 10,
          message: 'Existing comment message',
          creator: { id: 'u1', name: 'Director' } as unknown as CommentInfo['creator'],
          replies: [],
        },
      ]

      const mockProject = {
        guid: 'proj-1',
        lockedAccess: vi.fn((cb) => cb()),
        executeTransaction: vi.fn(),
      }
      const mockSeq = {
        guid: 'seq-guid-1',
        getZeroPoint: vi.fn().mockResolvedValue({ seconds: 0 }),
      }

      const result = await syncCommentsToSequence(
        mockProject as unknown as Project,
        mockSeq as unknown as Sequence,
        comments as CommentInfo[],
        existingLink,
      )

      expect(result.addedCount).toBe(0)
      expect(result.updatedLink.syncedMarkerGuids).toEqual(['legacy-marker-guid-1'])
      expect(mockSeqMarkers.createAddMarkerAction).not.toHaveBeenCalled()
    })

    it('does not advance synced comments when executeTransaction returns false', async () => {
      const mockSeqMarkers = {
        getMarkers: vi.fn().mockReturnValue([]),
        createAddMarkerAction: vi.fn().mockReturnValue({}),
      }

      const mockPpro = {
        Marker: { MARKER_TYPE_COMMENT: 'CommentMarkerType' },
        Markers: {
          getMarkers: vi.fn().mockResolvedValue(mockSeqMarkers),
        },
        TickTime: {
          TIME_ZERO: { ticks: '0' },
          createWithSeconds: vi.fn((sec) => ({ seconds: sec })),
        },
        Properties: {
          getProperties: vi.fn().mockResolvedValue({
            createSetValueAction: vi.fn().mockReturnValue({}),
          }),
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).window = {
        require: vi.fn().mockImplementation((name: string) => {
          if (name === 'premierepro') return mockPpro
          return null
        }),
      }

      const comments: Partial<CommentInfo>[] = [
        { id: 'comm-1', second: 10, message: 'Already synced' },
        { id: 'comm-2', second: 20, message: 'New comment' },
      ]

      const mockProject = {
        guid: 'proj-1',
        lockedAccess: vi.fn((cb) => cb()),
        executeTransaction: vi.fn().mockReturnValue(false),
      }
      const mockSeq = {
        guid: 'seq-guid-1',
        getZeroPoint: vi.fn().mockResolvedValue({ seconds: 0 }),
      }

      const result = await syncCommentsToSequence(
        mockProject as unknown as Project,
        mockSeq as unknown as Sequence,
        comments as CommentInfo[],
        existingLink,
      )

      expect(result.addedCount).toBe(0)
      expect(result.updatedLink.syncedCommentIds).toEqual(['comm-1'])
      expect(result.updatedLink.totalCommentsSynced).toBe(1)
    })

    it('does not advance synced comments when executeTransaction throws an error', async () => {
      const mockSeqMarkers = {
        getMarkers: vi.fn().mockReturnValue([]),
        createAddMarkerAction: vi.fn().mockReturnValue({}),
      }

      const mockPpro = {
        Marker: { MARKER_TYPE_COMMENT: 'CommentMarkerType' },
        Markers: {
          getMarkers: vi.fn().mockResolvedValue(mockSeqMarkers),
        },
        TickTime: {
          TIME_ZERO: { ticks: '0' },
          createWithSeconds: vi.fn((sec) => ({ seconds: sec })),
        },
        Properties: {
          getProperties: vi.fn().mockResolvedValue({
            createSetValueAction: vi.fn().mockReturnValue({}),
          }),
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).window = {
        require: vi.fn().mockImplementation((name: string) => {
          if (name === 'premierepro') return mockPpro
          return null
        }),
      }

      const comments: Partial<CommentInfo>[] = [
        { id: 'comm-1', second: 10, message: 'Already synced' },
        { id: 'comm-2', second: 20, message: 'New comment' },
      ]

      const mockProject = {
        guid: 'proj-1',
        lockedAccess: vi.fn(() => {
          throw new Error('Transaction execution crashed')
        }),
        executeTransaction: vi.fn(),
      }
      const mockSeq = {
        guid: 'seq-guid-1',
        getZeroPoint: vi.fn().mockResolvedValue({ seconds: 0 }),
      }

      const result = await syncCommentsToSequence(
        mockProject as unknown as Project,
        mockSeq as unknown as Sequence,
        comments as CommentInfo[],
        existingLink,
      )

      expect(result.addedCount).toBe(0)
      expect(result.updatedLink.syncedCommentIds).toEqual(['comm-1'])
      expect(result.updatedLink.totalCommentsSynced).toBe(1)
    })
  })
})
