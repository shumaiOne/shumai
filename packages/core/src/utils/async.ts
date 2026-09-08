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
  let firstError: unknown = null
  let hasError = false

  const workers = Array.from({ length: concurrency }, async () => {
    while (!hasError && nextIndex < items.length) {
      const idx = nextIndex++
      try {
        results[idx] = await fn(items[idx], idx)
      } catch (err) {
        if (!hasError) {
          hasError = true
          firstError = err
        }
        break
      }
    }
  })

  await Promise.all(workers)

  if (hasError) {
    throw firstError
  }

  return results
}
