'use client'

import * as React from 'react'
import { Lock, X } from 'lucide-react'
import { useStickyTopOffset } from '../shared/use-sticky-top-offset.hook'

export type BookingDetailRailProps = {
  readonly title: string
  readonly closeLabel: string
  readonly closeTitle?: string
  readonly readOnlyLabel?: string | null
  readonly kicker?: string | null
  readonly onClose: () => void
  readonly children: React.ReactNode
}

export function BookingDetailRail({ title, closeLabel, closeTitle, readOnlyLabel, kicker, onClose, children }: BookingDetailRailProps) {
  const railRef = React.useRef<HTMLElement>(null)
  const stickyOffset = useStickyTopOffset(railRef)

  return (
    <aside
      ref={railRef}
      aria-label={title}
      style={{ top: stickyOffset, maxHeight: `calc(100svh - ${String(stickyOffset)}px)` }}
      className="sticky flex w-80 shrink-0 flex-col self-start overflow-hidden border-l bg-sidebar"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 pb-3 pt-4">
        <span className="text-sm font-semibold">{title}</span>
        <button
          type="button"
          aria-label={closeLabel}
          title={closeTitle ?? closeLabel}
          onClick={onClose}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {readOnlyLabel ? (
          <span className="inline-flex h-6.5 items-center gap-1.5 self-start whitespace-nowrap rounded-full border border-status-warning-border bg-status-warning-bg px-2.5 text-xs font-semibold text-status-warning-text">
            <Lock className="size-3" /> {readOnlyLabel}
          </span>
        ) : null}
        {kicker ? (
          <span className="text-overline font-semibold uppercase tracking-wider text-muted-foreground">{kicker}</span>
        ) : null}
        {children}
      </div>
    </aside>
  )
}
