import { useLayoutEffect, useState } from 'react'

type ScreenSize = {
  width: number
  height: number
}

export function useScreenSize(): ScreenSize {
  const [size, setSize] = useState<ScreenSize>({
    width: window.innerWidth,
    height: window.innerHeight,
  })

  useLayoutEffect(() => {
    function handleResize() {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return size
}
