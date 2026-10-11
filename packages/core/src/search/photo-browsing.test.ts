import { beforeEach, describe, expect, it } from 'vitest'
import { AssetType, prisma } from '@shumai/db'
import { setupTestDbHooks } from '@shumai/db/test'
import { SearchService } from './search'

describe('SearchService — photo browsing (date taken sort, camera filter)', () => {
  setupTestDbHooks()

  let searchService: SearchService
  let rootId: string
  let projectId: string

  // name, date taken, camera, lens
  const files: Array<[string, string | null, string | null, string | null]> = [
    ['DSCF5543.JPG', '2026-09-06T15:32:57.000Z', 'FUJIFILM X100VI', 'FUJINON 23mm'],
    ['DSCF5543.RAF', '2026-09-06T15:32:57.000Z', 'FUJIFILM X100VI', 'FUJINON 23mm'],
    ['DSCF5544.RAF', '2026-09-07T10:00:00.000Z', 'FUJIFILM X100VI', null],
    ['_DSC2028.ARW', '2026-09-05T08:00:00.000Z', 'SONY ILCE-7CM2', 'FE 35mm F1.8'],
    ['notes', null, null, null],
  ]

  beforeEach(async () => {
    searchService = new SearchService()
    const team = await prisma.team.create({ data: { name: 'photo-team' } })
    const project = await prisma.project.create({ data: { name: 'p', teamId: team.id } })
    projectId = project.id
    const root = await prisma.asset.create({
      data: { name: 'root', type: AssetType.folder, projectId, status: 'uploaded' },
    })
    rootId = root.id
    for (const [name, taken, camera, lens] of files) {
      const a = await prisma.asset.create({
        data: { name, type: AssetType.file, projectId, parentId: root.id, status: 'processed' },
      })
      if (taken) {
        await prisma.assetMetadataValue.create({
          data: { assetId: a.id, fieldKey: 'capture_date', dateValue: new Date(taken) },
        })
      }
      if (camera) {
        await prisma.assetMetadataValue.create({
          data: { assetId: a.id, fieldKey: 'camera', stringValue: camera },
        })
      }
      if (lens) {
        await prisma.assetMetadataValue.create({
          data: { assetId: a.id, fieldKey: 'lens', stringValue: lens },
        })
      }
    }
  })

  const search = (extra: Record<string, unknown>) =>
    searchService.search(rootId, {
      assetType: 'file',
      recursively: false,
      operator: 'AND',
      conditions: [],
      isSemantic: false,
      sort: { field: 'name', order: 'asc' },
      ...extra,
    })

  it('sorts by date taken, files without one last', async () => {
    const desc = await search({ sort: { field: 'captureDate', order: 'desc' } })
    expect(desc.data.map((a) => a.name)).toEqual([
      'DSCF5544.RAF',
      'DSCF5543.RAF',
      'DSCF5543.JPG',
      '_DSC2028.ARW',
      'notes',
    ])
    const asc = await search({ sort: { field: 'captureDate', order: 'asc' } })
    expect(asc.data.map((a) => a.name)).toEqual([
      '_DSC2028.ARW',
      'DSCF5543.JPG',
      'DSCF5543.RAF',
      'DSCF5544.RAF',
      'notes',
    ])
  })

  it('pages a date-taken sort without repeating or skipping files', async () => {
    const sort = { field: 'captureDate', order: 'asc' }
    const first = await search({ sort, first: 3 })
    const second = await search({ sort, first: 3, after: first.pageInfo.cursor })
    expect([...first.data, ...second.data].map((a) => a.name)).toEqual([
      '_DSC2028.ARW',
      'DSCF5543.JPG',
      'DSCF5543.RAF',
      'DSCF5544.RAF',
      'notes',
    ])
  })

  it('filters by camera and lens (values ORed, facets ANDed)', async () => {
    const fuji = await search({ photo: { camera: ['FUJIFILM X100VI'] } })
    expect(fuji.data.map((a) => a.name)).toEqual(['DSCF5543.JPG', 'DSCF5543.RAF', 'DSCF5544.RAF'])
    expect(fuji.pageInfo.total).toBe(3)

    const either = await search({ photo: { camera: ['FUJIFILM X100VI', 'SONY ILCE-7CM2'] } })
    expect(either.data).toHaveLength(4)

    const both = await search({
      photo: { camera: ['FUJIFILM X100VI', 'SONY ILCE-7CM2'], lens: ['FE 35mm F1.8'] },
    })
    expect(both.data.map((a) => a.name)).toEqual(['_DSC2028.ARW'])
  })

  it('leaves folders alone when a camera filter is on', async () => {
    await prisma.asset.create({
      data: {
        name: 'sub',
        type: AssetType.folder,
        projectId,
        parentId: rootId,
        status: 'uploaded',
      },
    })
    const folders = await search({ assetType: 'folder', photo: { camera: ['SONY ILCE-7CM2'] } })
    expect(folders.data.map((a) => a.name)).toEqual(['sub'])
  })

  it('counts the files per camera and lens, most common first', async () => {
    const facets = await searchService.photoFacets(rootId)
    expect(facets.camera).toEqual([
      { value: 'FUJIFILM X100VI', count: 3 },
      { value: 'SONY ILCE-7CM2', count: 1 },
    ])
    expect(facets.lens).toEqual([
      { value: 'FUJINON 23mm', count: 2 },
      { value: 'FE 35mm F1.8', count: 1 },
    ])
  })

  it('counts subfolders on request, narrowed by search conditions', async () => {
    const sub = await prisma.asset.create({
      data: {
        name: 'Hari',
        type: AssetType.folder,
        projectId,
        parentId: rootId,
        status: 'uploaded',
      },
    })
    const shot = await prisma.asset.create({
      data: {
        name: 'DSCF1253.JPG',
        type: AssetType.file,
        projectId,
        parentId: sub.id,
        status: 'processed',
      },
    })
    await prisma.assetMetadataValue.create({
      data: { assetId: shot.id, fieldKey: 'camera', stringValue: 'FUJIFILM X-S20' },
    })

    // Only the folder's own files by default: the subfolder's camera is missing.
    expect((await searchService.photoFacets(rootId)).camera.map((f) => f.value)).not.toContain(
      'FUJIFILM X-S20',
    )

    const everything = await searchService.photoFacets(rootId, { recursively: true })
    expect(everything.camera).toEqual([
      { value: 'FUJIFILM X100VI', count: 3 },
      { value: 'FUJIFILM X-S20', count: 1 },
      { value: 'SONY ILCE-7CM2', count: 1 },
    ])

    const dscfOnly = await searchService.photoFacets(rootId, {
      recursively: true,
      operator: 'AND',
      conditions: [{ field: 'name', operator: 'contains', value: 'DSCF' }],
    })
    expect(dscfOnly.camera).toEqual([
      { value: 'FUJIFILM X100VI', count: 3 },
      { value: 'FUJIFILM X-S20', count: 1 },
    ])
  })

  it('limits cameras and lenses separately', async () => {
    for (let i = 0; i < 310; i++) {
      const a = await prisma.asset.create({
        data: {
          name: `c${i}.jpg`,
          type: AssetType.file,
          projectId,
          parentId: rootId,
          status: 'processed',
        },
      })
      await prisma.assetMetadataValue.create({
        data: { assetId: a.id, fieldKey: 'camera', stringValue: `Cam ${i}` },
      })
    }
    const facets = await searchService.photoFacets(rootId)
    expect(facets.camera).toHaveLength(300)
    // The lenses are not crowded out by the long camera list.
    expect(facets.lens.map((f) => f.value)).toContain('FUJINON 23mm')
  })
})
