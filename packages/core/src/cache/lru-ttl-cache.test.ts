import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LruTtlCache } from './lru-ttl-cache'

describe('LruTtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // performance.now() is also mocked by vi.useFakeTimers() in newer vitest versions
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should store and retrieve values', () => {
    const cache = new LruTtlCache<string, string>(10)
    cache.set('key1', 'value1', 1000)
    expect(cache.get('key1')).toBe('value1')
  })

  it('should return undefined for missing keys', () => {
    const cache = new LruTtlCache<string, string>(10)
    expect(cache.get('nonexistent')).toBeUndefined()
  })

  it('should evict items based on LRU policy', () => {
    const cache = new LruTtlCache<string, string>(2)
    cache.set('key1', 'value1', 1000)
    cache.set('key2', 'value2', 1000)
    
    // Access key1 to make it most recently used
    cache.get('key1')
    
    // Add key3, which should evict key2 (the least recently used)
    cache.set('key3', 'value3', 1000)
    
    expect(cache.get('key1')).toBe('value1')
    expect(cache.get('key2')).toBeUndefined()
    expect(cache.get('key3')).toBe('value3')
  })

  it('should return undefined for expired items', () => {
    const cache = new LruTtlCache<string, string>(10)
    cache.set('key1', 'value1', 1000)
    
    vi.advanceTimersByTime(1001)
    
    expect(cache.get('key1')).toBeUndefined()
    expect(cache.size).toBe(0)
  })

  it('should proactively evict expired items on get', () => {
    const sampleSize = 5
    const cache = new LruTtlCache<string, string>(100, sampleSize)
    
    // Set 10 items, all will expire
    for (let i = 0; i < 10; i++) {
      cache.set(`key${i}`, `value${i}`, 1000)
    }
    
    // Add one item that stays valid
    cache.set('valid', 'validValue', 5000)
    
    // Advance time so the 10 items expire
    vi.advanceTimersByTime(1001)
    
    // Total size should still be 11 (lazy eviction)
    expect(cache.size).toBe(11)
    
    // Call get on the valid item once. It should trigger one evictSample call.
    // evictSample will check 5 items.
    cache.get('valid')
    
    // Size should now be 11 - 5 = 6
    expect(cache.size).toBe(6)
    
    // Call get again, it should evict the remaining 5 expired items
    cache.get('valid')
    expect(cache.size).toBe(1)
    expect(cache.get('valid')).toBe('validValue')
  })

  it('should loop through the cache with proactive eviction', () => {
    // sampleSize = 3 to make sure we cover all items in one go or skip k3 correctly
    const cache = new LruTtlCache<string, string>(10, 3)
    
    cache.set('k1', 'v1', 1000)
    cache.set('k2', 'v2', 1000)
    cache.set('k3', 'v3', 5000)
    
    vi.advanceTimersByTime(1001)
    
    // First get: evicts k1, k2. Checks k3 (not expired).
    cache.get('k3')
    expect(cache.size).toBe(1)
    
    // Add more items
    cache.set('k4', 'v4', 1000)
    cache.set('k5', 'v5', 1000)
    
    vi.advanceTimersByTime(1001)
    
    // Second get: evicts k4, k5.
    cache.get('k3')
    expect(cache.size).toBe(1)
    expect(cache.get('k3')).toBe('v3')
  })

  it('should handle capacity <= 0', () => {
    const cache = new LruTtlCache<string, string>(0)
    cache.set('key1', 'value1', 1000)
    expect(cache.size).toBe(0)
    expect(cache.get('key1')).toBeUndefined()
  })

  it('should handle ttlMs <= 0', () => {
    const cache = new LruTtlCache<string, string>(10)
    cache.set('key1', 'value1', 0)
    expect(cache.size).toBe(0)
    expect(cache.get('key1')).toBeUndefined()

    cache.set('key2', 'value2', -100)
    expect(cache.size).toBe(0)
    expect(cache.get('key2')).toBeUndefined()
  })

  it('should handle manual deletions while the iterator is active', () => {
    // This test addresses the user's specific request:
    // "add 100 keys to cache, do a evictSample, and remove 99 keys manually, and do evictSample again, see what happen"
    const cache = new LruTtlCache<number, number>(200, 10)
    
    // Add 100 keys
    for (let i = 0; i < 100; i++) {
      cache.set(i, i, 10000)
    }
    
    // Initial get to trigger evictSample and initialize the iterator
    cache.get(999) 
    
    // Remove 99 keys manually (leaving key 99)
    for (let i = 0; i < 99; i++) {
      cache.delete(i)
    }
    expect(cache.size).toBe(1)
    
    // Advance time so the remaining key 99 would expire if it was checked
    vi.advanceTimersByTime(20000)
    
    // Call get. evictSample should run. 
    // The iterator was pointing to something that was deleted.
    // It should proceed to the next available element (key 99) and evict it.
    cache.get(999)
    expect(cache.size).toBe(0)
  })
})
