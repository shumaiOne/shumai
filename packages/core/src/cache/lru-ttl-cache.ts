export interface CacheEntry<V> {
  value: V
  expiresAt: number
}

/**
 * A generic LRU cache with TTL support and proactive sampling eviction.
 *
 * It uses a JavaScript Map to maintain insertion order for LRU eviction.
 * On every 'get' call, it samples a fixed number of items to check for expiration.
 */
export class LruTtlCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>()
  private maxCapacity: number
  private iterator: IterableIterator<K> | null = null
  private sampleSize: number

  constructor(capacity: number = 50000, sampleSize: number = 50) {
    this.maxCapacity = Math.max(0, capacity)
    this.sampleSize = Math.max(1, sampleSize)
  }

  /**
   * Gets a value from the cache.
   * Performs proactive eviction of expired items and refreshes the LRU position of the accessed item.
   */
  get(key: K): V | undefined {
    this.evictSample()

    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (this.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }

    // LRU: Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.value
  }

  /**
   * Sets a value in the cache with a specified TTL.
   * If the cache exceeds capacity, the least recently used item is evicted.
   */
  set(key: K, value: V, ttlMs: number): void {
    if (this.maxCapacity <= 0 || ttlMs <= 0 || isNaN(ttlMs)) {
      this.cache.delete(key)
      return
    }

    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxCapacity) {
      // LRU Eviction: Remove the first item (least recently used)
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, { value, expiresAt: this.now() + ttlMs })
  }

  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  /**
   * Proactively evicts a sample of items if they are expired.
   * Uses a persistent iterator to ensure all items are eventually checked.
   */
  private evictSample(): void {
    if (this.cache.size === 0) return

    if (!this.iterator) {
      this.iterator = this.cache.keys()
    }

    const now = this.now()
    for (let i = 0; i < this.sampleSize; i++) {
      let result = this.iterator.next()
      if (result.done) {
        this.iterator = this.cache.keys()
        result = this.iterator.next()
        if (result.done) break
      }

      const key = result.value
      const entry = this.cache.get(key)
      
      // If entry was manually deleted, entry will be undefined.
      // If it's expired, we delete it.
      if (entry && now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Monotonic time source to avoid issues with system clock jumps.
   */
  private now(): number {
    return performance.now()
  }

  get size(): number {
    return this.cache.size
  }

  clear(): void {
    this.cache.clear()
    this.iterator = null
  }
}
