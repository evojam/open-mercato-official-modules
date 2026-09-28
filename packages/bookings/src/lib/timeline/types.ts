import type * as React from 'react'
import type { WorkingCalendar } from '../pure-engine/working-days.rule'
import type { DayRange } from '../time/types'

export type TimelineRow = {
  id: string
  label: string
  title: string | null
  color: string | null
  iconName: string | null
  inactive: boolean
}

export type TimelineBarTone = 'normal' | 'conflict' | 'done'

export type TimelineBar = DayRange & {
  id: string
  rowId: string
  label: string
  title: string
  color: string | null
  tone: TimelineBarTone
}

export type TimelineUnavailability = DayRange & {
  id: string
  rowId: string
  label: string
  conflict: boolean
}

export type TimelineView = {
  rows: TimelineRow[]
  bars: TimelineBar[]
  unavailability: TimelineUnavailability[]
  window: DayRange
  calendar: WorkingCalendar
  wallClock: string | null
}

export type RowIconHost = {
  rowId: string
  node: HTMLElement
}

export type TimelineHandle = {
  update(view: TimelineView): void
  resize(widthPx: number): void
  select(barId: string | null): void
  rowIconHosts(): RowIconHost[]
  destroy(): void
}

export type TimelineMountOptions = {
  locale: string
  widthPx: number
  onSelectionChange?: (barId: string | null) => void
}

export type TimelineProps = {
  view: TimelineView
  locale: string
  selectedId?: string | null
  onSelectionChange?: (barId: string | null) => void
  onLoadError?: (error: unknown) => void
  renderRowIcon?: (row: TimelineRow) => React.ReactNode
}
