'use client'

import * as React from 'react'

export function useStickyTopOffset(ref: React.RefObject<HTMLElement | null>): number {
  const [offset, setOffset] = React.useState(0)

  React.useLayoutEffect(() => {
    const container = ref.current?.parentElement
    if (!container) return
    const sync = (): void => {
      setOffset(container.getBoundingClientRect().top + window.scrollY)
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(document.body)
    return () => {
      observer.disconnect()
    }
  }, [ref])

  return offset
}
