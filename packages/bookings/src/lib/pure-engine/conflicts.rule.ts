import { isIsoDate } from '../time/date-fns.adapter'
import type { DayRange } from '../time/types'
import type {
  Conflict,
  DetectConflictsInput,
  Placement,
  SubjectId,
  UnavailabilityWindow,
} from './types'
import { isOpen } from './status.rule'

export function overlaps(a: DayRange, b: DayRange): boolean {
  return a.from < b.to && a.to > b.from
}

function intersection(a: DayRange, b: DayRange): DayRange {
  return {
    from: a.from > b.from ? a.from : b.from,
    to: a.to < b.to ? a.to : b.to,
  }
}

function isUsable(range: DayRange): boolean {
  return isIsoDate(range.from) && isIsoDate(range.to) && range.from < range.to
}

function groupBySubject<T extends { subjectId: SubjectId }>(items: readonly T[]): Map<SubjectId, T[]> {
  const grouped = new Map<SubjectId, T[]>()
  for (const item of items) {
    const bucket = grouped.get(item.subjectId)
    if (bucket) bucket.push(item)
    else grouped.set(item.subjectId, [item])
  }
  return grouped
}

function byStart(a: DayRange, b: DayRange): number {
  if (a.from === b.from) return 0
  return a.from < b.from ? -1 : 1
}

function detectOverlaps(placements: readonly Placement[]): Conflict[] {
  const conflicts: Conflict[] = []

  for (const [subjectId, subjectPlacements] of groupBySubject(placements)) {
    const sorted: Placement[] = [...subjectPlacements].sort(byStart)

    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const earlier: Placement = sorted[i]
        const later: Placement = sorted[j]
        if (later.from >= earlier.to) break
        if (earlier.bookingId === later.bookingId) continue

        const range = intersection(earlier, later)
        conflicts.push({
          kind: 'overlap',
          subjectId,
          bookingId: earlier.bookingId,
          ...range,
          withBookingId: later.bookingId,
          withTargetName: later.targetName,
        })
        conflicts.push({
          kind: 'overlap',
          subjectId,
          bookingId: later.bookingId,
          ...range,
          withBookingId: earlier.bookingId,
          withTargetName: earlier.targetName,
        })
      }
    }
  }

  return conflicts
}

function detectUnavailability(
  placements: readonly Placement[],
  unavailability: readonly UnavailabilityWindow[]
): Conflict[] {
  const conflicts: Conflict[] = []
  const windowsBySubject = groupBySubject(unavailability)

  for (const placement of placements) {
    const windows = windowsBySubject.get(placement.subjectId)
    if (!windows) continue

    for (const window of windows) {
      if (!overlaps(placement, window)) continue

      conflicts.push({
        kind: 'unavailability',
        subjectId: placement.subjectId,
        bookingId: placement.bookingId,
        ...intersection(placement, window),
        withWindowId: window.windowId,
        reasonLabel: window.reasonLabel,
      })
    }
  }

  return conflicts
}

export function detectConflicts({ placements, unavailability = [] }: DetectConflictsInput): Conflict[] {
  const open = placements.filter((placement) => isOpen(placement.status) && isUsable(placement))
  const windows = unavailability.filter(isUsable)
  return [...detectOverlaps(open), ...detectUnavailability(open, windows)]
}
