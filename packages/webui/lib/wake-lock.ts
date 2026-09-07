let wakeLockSentinel: WakeLockSentinel | null = null
let wakeLockCount = 0

export async function acquireWakeLock(): Promise<void> {
  wakeLockCount++
  if (wakeLockCount > 1 && wakeLockSentinel) {
    return
  }

  if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen')
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null
      })
    } catch (err) {
      console.warn('Screen Wake Lock request failed:', err)
    }
  }
}

export async function releaseWakeLock(): Promise<void> {
  wakeLockCount = Math.max(0, wakeLockCount - 1)
  if (wakeLockCount === 0 && wakeLockSentinel) {
    try {
      await wakeLockSentinel.release()
    } catch (err) {
      console.warn('Screen Wake Lock release failed:', err)
    } finally {
      wakeLockSentinel = null
    }
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && wakeLockCount > 0 && !wakeLockSentinel) {
      try {
        if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
          wakeLockSentinel = await navigator.wakeLock.request('screen')
          wakeLockSentinel.addEventListener('release', () => {
            wakeLockSentinel = null
          })
        }
      } catch (err) {
        console.warn('Screen Wake Lock re-acquisition failed:', err)
      }
    }
  })
}
