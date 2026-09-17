import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  saveSequenceLinkToCache,
  getSequenceLinkFromCache,
  removeSequenceLinkFromCache,
  getAllSequenceLinksFromCache,
  getAllLinkedSequences,
  getSequenceLink,
  saveSequenceLink,
  removeSequenceLink,
  normalizeGuid,
  LINK_STORAGE_PROP_KEY,
} from './linkStorage'
import * as commentUtils from './commentUtils'
import type { Project, Sequence } from '@adobe/premierepro'
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
    key: (index: number) => Object.keys(store)[index] || null,
    get length() {
      return Object.keys(store).length
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true,
})

describe('linkStorage service', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    // Reset global require
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).require
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window
  })

  const sampleLink: LinkedSequenceAsset = {
    sequenceGuid: 'seq-guid-1',
    sequenceName: 'Sequence 01',
    assetId: 'asset-1',
    assetName: 'video.mp4',
    syncedCommentIds: ['comm-1', 'comm-2'],
    lastSyncAt: 1000,
    totalCommentsSynced: 2,
  }

  describe('cache operations (localStorage)', () => {
    it('saves and retrieves link from cache', () => {
      saveSequenceLinkToCache(sampleLink, 'proj-1')
      const result = getSequenceLinkFromCache('seq-guid-1', 'proj-1')
      expect(result).toEqual(sampleLink)
    })

    it('returns null when link is not in cache', () => {
      expect(getSequenceLinkFromCache('unknown-seq', 'proj-1')).toBeNull()
    })

    it('lists all links for a project', () => {
      saveSequenceLinkToCache(sampleLink, 'proj-1')
      const link2: LinkedSequenceAsset = {
        ...sampleLink,
        sequenceGuid: 'seq-guid-2',
        sequenceName: 'Sequence 02',
      }
      saveSequenceLinkToCache(link2, 'proj-1')

      const all = getAllSequenceLinksFromCache('proj-1')
      expect(all).toHaveLength(2)
      expect(all.map((l) => l.sequenceGuid)).toContain('seq-guid-1')
      expect(all.map((l) => l.sequenceGuid)).toContain('seq-guid-2')
    })

    it('removes a link from cache', () => {
      saveSequenceLinkToCache(sampleLink, 'proj-1')
      expect(getSequenceLinkFromCache('seq-guid-1', 'proj-1')).not.toBeNull()

      removeSequenceLinkFromCache('seq-guid-1', 'proj-1')
      expect(getSequenceLinkFromCache('seq-guid-1', 'proj-1')).toBeNull()
    })

    it('returns all links across projects when projectGuid is omitted', () => {
      saveSequenceLinkToCache(sampleLink, 'proj-1')
      const link2: LinkedSequenceAsset = {
        ...sampleLink,
        sequenceGuid: 'seq-guid-2',
        sequenceName: 'Sequence 02',
        assetId: 'asset-2',
      }
      saveSequenceLinkToCache(link2, 'proj-2')

      const all = getAllSequenceLinksFromCache()
      expect(all).toHaveLength(2)
      expect(all.map((l) => l.sequenceGuid)).toContain('seq-guid-1')
      expect(all.map((l) => l.sequenceGuid)).toContain('seq-guid-2')
    })

    it('does not return links from default cache when projectGuid is specified', () => {
      saveSequenceLinkToCache(sampleLink, null)
      const result = getAllSequenceLinksFromCache('proj-unknown')
      expect(result).toEqual([])
    })
  })

  describe('host sequence properties integration', () => {
    it('retrieves persistent property from sequence when available', async () => {
      const mockProps = {
        getValue: vi.fn().mockReturnValue(JSON.stringify(sampleLink)),
      }
      const mockPpro = {
        Properties: {
          getProperties: vi.fn().mockResolvedValue(mockProps),
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).window = {
        require: vi.fn().mockImplementation((name: string) => {
          if (name === 'premierepro') return mockPpro
          return null
        }),
      }

      const mockSeq = { guid: 'seq-guid-1' }
      const mockProj = { guid: 'proj-1' }

      const link = await getSequenceLink(
        mockSeq as unknown as Sequence,
        mockProj as unknown as Project,
      )
      expect(link).toEqual(sampleLink)
      expect(mockProps.getValue).toHaveBeenCalledWith(LINK_STORAGE_PROP_KEY)
    })

    it('saves persistent property and executes transaction', async () => {
      const mockCompoundAction = { addAction: vi.fn() }
      const mockProps = {
        createSetValueAction: vi.fn().mockReturnValue({ id: 'action-set' }),
      }
      const mockPpro = {
        Properties: {
          getProperties: vi.fn().mockResolvedValue(mockProps),
          PROPERTY_PERSISTENT: 1,
        },
        Constants: {
          PropertyType: { PERSISTENT: 1 },
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).window = {
        require: vi.fn().mockImplementation((name: string) => {
          if (name === 'premierepro') return mockPpro
          return null
        }),
      }

      const mockSeq = { guid: 'seq-guid-1' }
      const mockProj = {
        guid: 'proj-1',
        lockedAccess: vi.fn((cb) => cb()),
        executeTransaction: vi.fn((cb) => {
          cb(mockCompoundAction)
          return true
        }),
      }

      const success = await saveSequenceLink(
        mockProj as unknown as Project,
        mockSeq as unknown as Sequence,
        sampleLink,
      )
      expect(success).toBe(true)
      expect(mockProps.createSetValueAction).toHaveBeenCalledWith(
        LINK_STORAGE_PROP_KEY,
        JSON.stringify(sampleLink),
        1,
      )
      expect(mockCompoundAction.addAction).toHaveBeenCalledWith({ id: 'action-set' })
    })

    it('clears persistent property on removeSequenceLink', async () => {
      const mockCompoundAction = { addAction: vi.fn() }
      const mockProps = {
        createClearValueAction: vi.fn().mockReturnValue({ id: 'action-clear' }),
      }
      const mockPpro = {
        Properties: {
          getProperties: vi.fn().mockResolvedValue(mockProps),
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).window = {
        require: vi.fn().mockImplementation((name: string) => {
          if (name === 'premierepro') return mockPpro
          return null
        }),
      }

      const mockSeq = { guid: 'seq-guid-1' }
      const mockProj = {
        guid: 'proj-1',
        lockedAccess: vi.fn((cb) => cb()),
        executeTransaction: vi.fn((cb) => {
          cb(mockCompoundAction)
          return true
        }),
      }

      const success = await removeSequenceLink(
        mockProj as unknown as Project,
        mockSeq as unknown as Sequence,
      )
      expect(success).toBe(true)
      expect(mockProps.createClearValueAction).toHaveBeenCalledWith(LINK_STORAGE_PROP_KEY)
    })

    it('removes synced markers matching syncedMarkerGuids on removeSequenceLink, preserving manual markers', async () => {
      const mockCompoundAction = { addAction: vi.fn() }
      const mockProps = {
        getValue: vi.fn().mockReturnValue(
          JSON.stringify({
            ...sampleLink,
            syncedMarkerGuids: ['synced-marker-1', 'synced-marker-2'],
          }),
        ),
        createClearValueAction: vi.fn().mockReturnValue({ id: 'action-clear' }),
      }

      const mockMarker1 = {
        guid: 'synced-marker-1',
        name: 'Director (edited)',
        comments: 'Edited comment',
      }
      const mockMarker2 = { guid: 'synced-marker-2', name: 'Producer', comments: 'Another comment' }
      const mockManualMarker = {
        guid: 'manual-user-marker',
        name: 'Editor Note',
        comments: 'Manual marker',
      }

      const mockSeqMarkers = {
        getMarkers: vi.fn().mockReturnValue([mockMarker1, mockManualMarker, mockMarker2]),
        createRemoveMarkerAction: vi.fn().mockImplementation((marker) => ({
          type: 'remove-marker',
          guid: marker.guid,
        })),
      }

      const mockPpro = {
        Properties: {
          getProperties: vi.fn().mockResolvedValue(mockProps),
        },
        Markers: {
          getMarkers: vi.fn().mockResolvedValue(mockSeqMarkers),
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).window = {
        require: vi.fn().mockImplementation((name: string) => {
          if (name === 'premierepro') return mockPpro
          return null
        }),
      }

      const mockSeq = { guid: 'seq-guid-1' }
      const mockProj = {
        guid: 'proj-1',
        lockedAccess: vi.fn((cb) => cb()),
        executeTransaction: vi.fn((cb) => {
          cb(mockCompoundAction)
          return true
        }),
      }

      const success = await removeSequenceLink(
        mockProj as unknown as Project,
        mockSeq as unknown as Sequence,
      )
      expect(success).toBe(true)

      // Only synced-marker-1 and synced-marker-2 should be removed; manual-user-marker must NOT be removed
      expect(mockSeqMarkers.createRemoveMarkerAction).toHaveBeenCalledTimes(2)
      expect(mockSeqMarkers.createRemoveMarkerAction).toHaveBeenCalledWith(mockMarker1)
      expect(mockSeqMarkers.createRemoveMarkerAction).toHaveBeenCalledWith(mockMarker2)
      expect(mockSeqMarkers.createRemoveMarkerAction).not.toHaveBeenCalledWith(mockManualMarker)

      expect(mockCompoundAction.addAction).toHaveBeenCalledWith({
        type: 'remove-marker',
        guid: 'synced-marker-1',
      })
      expect(mockCompoundAction.addAction).toHaveBeenCalledWith({
        type: 'remove-marker',
        guid: 'synced-marker-2',
      })
      expect(mockProps.createClearValueAction).toHaveBeenCalledWith(LINK_STORAGE_PROP_KEY)
    })

    it('removes markers by comment matching fallback when syncedMarkerGuids is empty', async () => {
      localStorage.setItem('shumai_uxp_endpoint', 'https://shumai.example.com')
      localStorage.setItem('shumai_uxp_api_key', 'test-api-key')

      vi.spyOn(commentUtils, 'fetchAssetComments').mockResolvedValue([
        {
          id: 'comm-1',
          creator: {
            id: 'u1',
            name: 'Director',
          } as unknown as import('@shumai/dtos').CommentInfo['creator'],
          message: 'Please trim this scene',
        } as unknown as import('@shumai/dtos').CommentInfo,
      ])

      const mockCompoundAction = { addAction: vi.fn() }
      const mockProps = {
        getValue: vi.fn().mockReturnValue(
          JSON.stringify({
            ...sampleLink,
            syncedMarkerGuids: [],
          }),
        ),
        createClearValueAction: vi.fn().mockReturnValue({ id: 'action-clear' }),
      }

      const mockLegacyShumaiMarker = {
        guid: 'legacy-guid-1',
        getName: () => 'Director',
        getComments: () => 'Please trim this scene',
      }
      const mockManualMarker = {
        guid: 'manual-guid-2',
        getName: () => 'Editor',
        getComments: () => 'My own note',
      }

      const mockSeqMarkers = {
        getMarkers: vi.fn().mockReturnValue([mockLegacyShumaiMarker, mockManualMarker]),
        createRemoveMarkerAction: vi.fn().mockImplementation((marker) => ({
          type: 'remove-marker',
          guid: marker.guid,
        })),
      }

      const mockPpro = {
        Properties: {
          getProperties: vi.fn().mockResolvedValue(mockProps),
        },
        Markers: {
          getMarkers: vi.fn().mockResolvedValue(mockSeqMarkers),
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).window = {
        require: vi.fn().mockImplementation((name: string) => {
          if (name === 'premierepro') return mockPpro
          return null
        }),
      }

      const mockSeq = { guid: 'seq-guid-1' }
      const mockProj = {
        guid: 'proj-1',
        lockedAccess: vi.fn((cb) => cb()),
        executeTransaction: vi.fn((cb) => {
          cb(mockCompoundAction)
          return true
        }),
      }

      const success = await removeSequenceLink(
        mockProj as unknown as Project,
        mockSeq as unknown as Sequence,
      )
      expect(success).toBe(true)

      expect(mockSeqMarkers.createRemoveMarkerAction).toHaveBeenCalledWith(mockLegacyShumaiMarker)
      expect(mockSeqMarkers.createRemoveMarkerAction).not.toHaveBeenCalledWith(mockManualMarker)
    })

    it('attempts individual marker removals if compound batch remove returns false', async () => {
      const mockCompoundAction = { addAction: vi.fn() }
      const mockProps = {
        getValue: vi.fn().mockReturnValue(
          JSON.stringify({
            ...sampleLink,
            syncedMarkerGuids: ['synced-1'],
          }),
        ),
        createClearValueAction: vi.fn().mockReturnValue({ id: 'action-clear' }),
      }

      const mockMarker = { guid: 'synced-1' }
      const mockSeqMarkers = {
        getMarkers: vi.fn().mockReturnValue([mockMarker]),
        createRemoveMarkerAction: vi.fn().mockReturnValue({ type: 'remove-marker' }),
      }

      const mockPpro = {
        Properties: {
          getProperties: vi.fn().mockResolvedValue(mockProps),
        },
        Markers: {
          getMarkers: vi.fn().mockResolvedValue(mockSeqMarkers),
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).window = {
        require: vi.fn().mockImplementation((name: string) => {
          if (name === 'premierepro') return mockPpro
          return null
        }),
      }

      let txCount = 0
      const mockProj = {
        guid: 'proj-1',
        lockedAccess: vi.fn((cb) => cb()),
        executeTransaction: vi.fn((cb) => {
          txCount++
          cb(mockCompoundAction)
          if (txCount === 1) return false // batch failed
          return true // individual succeeded
        }),
      }

      const mockSeq = { guid: 'seq-guid-1' }
      const success = await removeSequenceLink(
        mockProj as unknown as Project,
        mockSeq as unknown as Sequence,
      )
      expect(success).toBe(true)
      expect(txCount).toBeGreaterThanOrEqual(2)
    })
  })

  describe('getAllLinkedSequences', () => {
    it('does not leak cached links across projects when a project has an empty sequence list', async () => {
      saveSequenceLinkToCache(sampleLink, 'proj-A')
      const defaultLink: LinkedSequenceAsset = {
        ...sampleLink,
        sequenceGuid: 'seq-default',
        sequenceName: 'Default Seq',
      }
      saveSequenceLinkToCache(defaultLink, null)

      const mockProjB = {
        guid: 'proj-B',
        getSequences: vi.fn().mockResolvedValue([]),
      }

      const results = await getAllLinkedSequences(mockProjB as unknown as Project, [])
      expect(results).toEqual([])
    })

    it('restores cached link only if the sequence actually exists in the project', async () => {
      saveSequenceLinkToCache(sampleLink, 'proj-A')

      const mockSeq1 = { guid: 'seq-guid-1' }
      const mockSeq2 = { guid: 'seq-guid-2' }

      const mockProjA = {
        guid: 'proj-A',
        getSequences: vi.fn().mockResolvedValue([mockSeq1]),
      }

      const results = await getAllLinkedSequences(mockProjA as unknown as Project, [
        mockSeq1 as unknown as Sequence,
      ])
      expect(results).toHaveLength(1)
      expect(results[0].sequenceGuid).toBe('seq-guid-1')

      const resultsSeq2 = await getAllLinkedSequences(mockProjA as unknown as Project, [
        mockSeq2 as unknown as Sequence,
      ])
      expect(resultsSeq2).toHaveLength(0)
    })
  })

  describe('normalizeGuid', () => {
    it('normalizes GUIDs with uppercase, braces, whitespace, and objects', () => {
      expect(normalizeGuid('{1234-ABCD-5678}')).toBe('1234-abcd-5678')
      expect(normalizeGuid('  ABC-DEF  ')).toBe('abc-def')
      expect(normalizeGuid({ toString: () => '{Guid-Obj}' })).toBe('guid-obj')
      expect(normalizeGuid(null)).toBe('')
      expect(normalizeGuid(undefined)).toBe('')
    })
  })
})
