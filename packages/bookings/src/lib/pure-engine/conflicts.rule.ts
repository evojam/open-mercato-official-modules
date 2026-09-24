import type {
  Conflict,
  DetectConflictsInput,
  Interval,
  Placement,
  SubjectId,
  UnavailabilityWindow,
} from './types'
import { isOpen } from './status.rule'

export function overlaps(a: Interval, b: Interval): boolean {
  return a.from.getTime() < b.to.getTime() && a.to.getTime() > b.from.getTime()
}

function intersection(a: Interval, b: Interval): Interval {
  return {
    from: new Date(Math.max(a.from.getTime(), b.from.getTime())),
    to: new Date(Math.min(a.to.getTime(), b.to.getTime())),
  }
}

function isUsable(interval: Interval): boolean {
  const from = interval.from.getTime()
  const to = interval.to.getTime()
  return Number.isFinite(from) && Number.isFinite(to) && from < to
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

function byStart(a: Interval, b: Interval): number {
  return a.from.getTime() - b.from.getTime()
}

function detectOverlaps(placements: readonly Placement[]): Conflict[] {
  const conflicts: Conflict[] = []

  for (const [subjectId, subjectPlacements] of groupBySubject(placements)) {
    const sorted: Placement[] = [...subjectPlacements].sort(byStart)

    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const earlier: Placement = sorted[i]
        const later: Placement = sorted[j]
        if (later.from.getTime() >= earlier.to.getTime()) break
        if (earlier.bookingId === later.bookingId) continue

        const range = intersection(earlier, later)
        conflicts.push({
          kind: 'overlap',
          subjectId,
          bookingId: earlier.bookingId,
          from: new Date(range.from),
          to: new Date(range.to),
          withBookingId: later.bookingId,
          withTargetName: later.targetName,
        })
        conflicts.push({
          kind: 'overlap',
          subjectId,
          bookingId: later.bookingId,
          from: new Date(range.from),
          to: new Date(range.to),
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

      const range = intersection(placement, window)
      conflicts.push({
        kind: 'unavailability',
        subjectId: placement.subjectId,
        bookingId: placement.bookingId,
        from: range.from,
        to: range.to,
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
