import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  saveSequenceLinkToCache,
  getSequenceLinkFromCache,
  removeSequenceLinkFromCache,
  getAllSequenceLinksFromCache,
  getSequenceLink,
  saveSequenceLink,
  removeSequenceLink,
  LINK_STORAGE_PROP_KEY,
} from './linkStorage'
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
  })
})
