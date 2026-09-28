import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import { isClosed } from '../../../../lib/pure-engine'
import type { Conflict } from '../../../../lib/pure-engine'
import { lastDayOf } from '../../../../lib/timeline/layout/range'
import type { TimelineBar, TimelineBarTone, TimelineRow, TimelineView } from '../../../../lib/timeline/types'
import type { DayRange, IsoDate } from '../../../../lib/time/types'
import type { TimelineBarDto, TimelineReadDto } from '../../services/timeline/timeline-read.service'

export type TimelinePresenterDeps = {
  t: TranslateFn
  formatDate: (date: IsoDate) => string
}

export function barId(bar: Pick<TimelineBarDto, 'bookingId' | 'subjectId'>): string {
  return `${bar.bookingId}:${bar.subjectId}`
}

export function daysLabel(range: DayRange, formatDate: TimelinePresenterDeps['formatDate']): string {
  const last = lastDayOf(range)
  return last === range.from ? formatDate(range.from) : `${formatDate(range.from)} – ${formatDate(last)}`
}

function conflictLine(conflict: Conflict, deps: TimelinePresenterDeps): string {
  const days = daysLabel(conflict, deps.formatDate)
  if (conflict.kind === 'overlap') {
    return deps.t('bookings.timeline.conflicts.overlap', 'Overlaps {target} ({days})', {
      target: conflict.withTargetName ?? deps.t('bookings.timeline.conflicts.otherBooking', 'another booking'),
      days,
    })
  }
  return conflict.reasonLabel
    ? deps.t('bookings.timeline.conflicts.unavailableBecause', 'Unavailable: {reason} ({days})', {
        reason: conflict.reasonLabel,
        days,
      })
    : deps.t('bookings.timeline.conflicts.unavailable', 'Unavailable ({days})', { days })
}

function toneOf(bar: TimelineBarDto): TimelineBarTone {
  if (isClosed(bar.status)) return 'done'
  return bar.conflicts.length > 0 ? 'conflict' : 'normal'
}

function barOf(bar: TimelineBarDto, deps: TimelinePresenterDeps): TimelineBar {
  const lines = [
    `${bar.targetName} · ${daysLabel(bar, deps.formatDate)}`,
    deps.t(`bookings.bookings.status.${bar.status}`, bar.status),
    ...(bar.note ? [bar.note] : []),
    ...bar.conflicts.map((conflict) => conflictLine(conflict, deps)),
  ]
  return {
    id: barId(bar),
    rowId: bar.subjectId,
    from: bar.from,
    to: bar.to,
    label: bar.targetName,
    title: lines.join('\n'),
    color: bar.targetColor,
    tone: toneOf(bar),
  }
}

function rowOf(row: TimelineReadDto['rows'][number], t: TranslateFn): TimelineRow {
  const hints = [
    ...(row.category ? [row.category.name] : []),
    ...(row.isActive ? [] : [t('bookings.timeline.rows.inactive', 'Inactive')]),
    ...(row.unavailabilityKnown
      ? []
      : [t('bookings.timeline.rows.unavailabilityUnknown', 'Unavailability unknown for this subject')]),
  ]
  return {
    id: row.subjectId,
    label: row.name,
    title: hints.length ? hints.join('\n') : null,
    color: row.category?.color ?? null,
    iconName: row.category ? (row.category.icon ?? 'box') : null,
    inactive: !row.isActive,
  }
}

export function presentTimeline(dto: TimelineReadDto, deps: TimelinePresenterDeps): TimelineView {
  const conflictedWindows = new Set(
    dto.bars.flatMap((bar) =>
      isClosed(bar.status)
        ? []
        : bar.conflicts.flatMap((conflict) => (conflict.kind === 'unavailability' ? [conflict.withWindowId] : []))
    )
  )
  return {
    rows: dto.rows.map((row) => rowOf(row, deps.t)),
    bars: dto.bars.map((bar) => barOf(bar, deps)),
    unavailability: dto.unavailability.map((window) => ({
      id: window.windowId,
      rowId: window.subjectId,
      from: window.from,
      to: window.to,
      label: window.reason ?? deps.t('bookings.timeline.backgrounds.unavailable', 'Unavailable'),
      conflict: conflictedWindows.has(window.windowId),
    })),
    window: dto.range,
    calendar: dto.calendar,
    wallClock: dto.wallClock,
  }
}
