/**
 * Maps an array of items with an async mapping function subject to a concurrency limit.
 * Results are returned in the same order as the input items array.
 */
export async function mapConcurrent<T, TResult>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  if (items.length === 0) {
    return []
  }

  const concurrency = Math.max(1, Math.min(limit, items.length))
  const results: TResult[] = new Array(items.length)
  let nextIndex = 0

  const workers = Array.from({ length: concurrency }, async () => {
    while (nextIndex < items.length) {
      const idx = nextIndex++
      results[idx] = await fn(items[idx], idx)
    }
  })

  await Promise.all(workers)
  return results
}
