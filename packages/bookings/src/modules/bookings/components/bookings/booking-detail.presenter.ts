import { leadingProblemKind, presentBookingCard, problemKindsOf } from '../../../../lib/booking-card'
import type { BookingCardDeps, BookingCardViewModel, BookingProblemKind } from '../../../../lib/booking-card'
import type { BookingStatus } from '../../../../lib/pure-engine'
import type { TimelineBarDto, TimelineReadDto, TimelineRowDto } from '../../services/timeline/timeline-read.service'
import { parseBarId } from '../timeline/timeline.presenter'

export type BookingDetailEntry = {
  readonly bookingId: string
  readonly status: BookingStatus
  readonly hasConflict: boolean
  readonly vm: BookingCardViewModel
}

export type BookingDetailSelection = {
  readonly primary: BookingDetailEntry
  readonly partners: readonly BookingDetailEntry[]
  readonly problem: BookingProblemKind | null
}

function entryOf(bar: TimelineBarDto, row: TimelineRowDto | undefined, deps: BookingCardDeps): BookingDetailEntry {
  const hasConflict = bar.conflicts.length > 0
  return {
    bookingId: bar.bookingId,
    status: bar.status,
    hasConflict,
    vm: presentBookingCard({
      booking: {
        id: bar.bookingId,
        status: bar.status,
        days: { from: bar.from, to: bar.to },
        durationValue: bar.durationValue,
        expectedStartOn: bar.expectedStartOn,
        note: bar.note,
        targetName: bar.targetName,
        targetColor: bar.targetColor,
        hasConflict,
      },
      subjectName: row?.name ?? '',
      subjectSubtitle: row?.category?.name,
      subjectColor: row?.category?.color,
      subjectIconName: row?.category?.icon,
      deps,
    }),
  }
}

export function selectBookingDetail(
  view: TimelineReadDto,
  selectedId: string | null,
  deps: BookingCardDeps
): BookingDetailSelection | null {
  const selected = selectedId ? parseBarId(selectedId) : null
  if (!selected) return null
  const bar = view.bars.find((item) => item.bookingId === selected.bookingId && item.subjectId === selected.subjectId)
  if (!bar) return null
  const row = view.rows.find((item) => item.subjectId === bar.subjectId)
  const partnerIds = new Set(bar.conflicts.flatMap((conflict) => (conflict.kind === 'overlap' ? [conflict.withBookingId] : [])))
  const partners = view.bars
    .filter((item) => item.subjectId === bar.subjectId && partnerIds.has(item.bookingId))
    .map((item) => entryOf(item, row, deps))
  return {
    primary: entryOf(bar, row, deps),
    partners,
    problem: leadingProblemKind(problemKindsOf(bar.conflicts, bar.targetId)),
  }
}
