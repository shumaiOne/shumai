import { marshal, unmarshal } from '@shumai/core/src/hyrumtoken'

const key = new Uint8Array([
  0x38, 0x9c, 0xf5, 0xe7, 0xfe, 0xa5, 0x6a, 0xe7, 0xbe, 0x0e, 0x6a, 0x47, 0x19, 0x9f, 0xb1, 0x81,
  0xcc, 0x83, 0xb8, 0x94, 0x62, 0xd7, 0xb0, 0x22, 0x18, 0xa6, 0x36, 0x57, 0xde, 0xfa, 0x70, 0xe9,
])

export interface PaginationParams {
  first?: number
  after?: string
}

export interface PageInfo {
  total?: number
  cursor?: string
}

export interface PaginatedData<T> {
  data: T
  pageInfo: PageInfo
}

export function encodeCursor(offset: number): string {
  return marshal(key, offset.toString())
}

export function decodeCursor(cursor: string): number {
  const decoded = unmarshal(key, cursor)
  return parseInt(decoded, 10)
}

/**
 * Helper function to handle cursor pagination using skip/take logic
 * with encoded cursors.
 */
export async function paginateQuery<T>(
  queryFn: (skip: number, take: number) => Promise<T[]>,
  countFn: (() => Promise<number>) | null,
  params: PaginationParams,
): Promise<PaginatedData<T[]>> {
  const info: PageInfo = {}

  if (countFn) {
    info.total = await countFn()
  }

  let limit = params.first || 20
  if (limit <= 0 || limit > 200) {
    limit = 20
  }

  let offset = 0
  if (params.after) {
    offset = decodeCursor(params.after)
  }

  // Request one extra item to check if there is a next page
  const results = await queryFn(offset, limit + 1)

  if (results.length > limit) {
    info.cursor = encodeCursor(offset + limit)
    return { data: results.slice(0, limit), pageInfo: info }
  }

  return { data: results, pageInfo: info }
}
