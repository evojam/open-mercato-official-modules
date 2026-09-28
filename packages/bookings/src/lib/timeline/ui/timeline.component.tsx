'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { daysIn } from '../layout/range'
import type { RowIconHost, TimelineHandle, TimelineProps } from '../types'
import { mountTimeline } from '../vis-timeline.adapter'
import { TIMELINE_CSS, TIMELINE_ROOT_CLASS } from './timeline.styles'

const MIN_DAY_PX = 80

export function Timeline({ view, locale, selectedId, onSelectionChange, onLoadError, renderRowIcon }: TimelineProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const mountRef = React.useRef<HTMLDivElement | null>(null)
  const handle = React.useRef<TimelineHandle | null>(null)
  const latestView = React.useRef(view)
  const onSelection = React.useRef(onSelectionChange)
  const onError = React.useRef(onLoadError)
  latestView.current = view
  onSelection.current = onSelectionChange
  onError.current = onLoadError

  const [availableWidth, setAvailableWidth] = React.useState(0)
  const [iconHosts, setIconHosts] = React.useState<{ hosts: RowIconHost[]; revision: number }>({
    hosts: [],
    revision: 0,
  })
  // A day column never goes below MIN_DAY_PX, but a range that fits gets stretched instead of leaving the board half empty.
  const widthPx = Math.max(availableWidth, daysIn(view.window).length * MIN_DAY_PX)
  const latestWidth = React.useRef(widthPx)
  latestWidth.current = widthPx

  React.useEffect(() => {
    const node = scrollRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => setAvailableWidth(entries[0]?.contentRect.width ?? 0))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    const element = mountRef.current
    if (!element) return
    let disposed = false
    void mountTimeline(element, latestView.current, {
      locale,
      widthPx: latestWidth.current,
      onSelectionChange: (barId) => onSelection.current?.(barId),
    }).then((mounted) => {
      if (disposed) {
        mounted.destroy()
        return
      }
      handle.current = mounted
      mounted.update(latestView.current)
      mounted.resize(latestWidth.current)
      setIconHosts((previous) => ({ hosts: mounted.rowIconHosts(), revision: previous.revision + 1 }))
    }).catch((error: unknown) => {
      if (!disposed) onError.current?.(error)
    })
    return () => {
      disposed = true
      handle.current?.destroy()
      handle.current = null
      setIconHosts({ hosts: [], revision: 0 })
    }
  }, [locale])

  React.useEffect(() => {
    const mounted = handle.current
    if (!mounted) return
    mounted.update(view)
    setIconHosts((previous) => ({ hosts: mounted.rowIconHosts(), revision: previous.revision + 1 }))
  }, [view])

  React.useEffect(() => {
    handle.current?.resize(widthPx)
  }, [widthPx])

  React.useEffect(() => {
    handle.current?.select(selectedId ?? null)
  }, [selectedId, view])

  const rowById = React.useMemo(() => new Map(view.rows.map((row) => [row.id, row])), [view.rows])

  return (
    <div className={TIMELINE_ROOT_CLASS}>
      <style>{TIMELINE_CSS}</style>
      <div ref={scrollRef} style={{ overflowX: 'auto' }}>
        <div ref={mountRef} />
      </div>
      {renderRowIcon
        ? iconHosts.hosts.map(({ rowId, node }) => {
            const row = rowById.get(rowId)
            if (!row) return null
            return <React.Fragment key={`${rowId}-${iconHosts.revision}`}>{createPortal(renderRowIcon(row), node)}</React.Fragment>
          })
        : null}
    </div>
  )
}
