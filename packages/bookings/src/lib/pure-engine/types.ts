import type { BookingStatus } from './status.rule'

export type SubjectId = string

export type BookingId = string

export type Interval = {
  from: Date
  to: Date
}

export type Placement = Interval & {
  bookingId: BookingId
  subjectId: SubjectId
  status: BookingStatus
  targetName?: string
}

// Caller-normalised: `from` and `to` are instants derived in the zone that owns the window —
// the subject's own zone, which is where its leave and its inspections are expressed. Handing
// over the raw instants planner stores flags the neighbouring day for every zone east of UTC.
export type UnavailabilityWindow = Interval & {
  windowId: string
  subjectId: SubjectId
  reasonLabel?: string
}

export type OverlapConflict = Interval & {
  kind: 'overlap'
  subjectId: SubjectId
  bookingId: BookingId
  withBookingId: BookingId
  withTargetName?: string
}

export type UnavailabilityConflict = Interval & {
  kind: 'unavailability'
  subjectId: SubjectId
  bookingId: BookingId
  withWindowId: string
  reasonLabel?: string
}

export type Conflict = OverlapConflict | UnavailabilityConflict

export type DetectConflictsInput = {
  placements: readonly Placement[]
  unavailability?: readonly UnavailabilityWindow[]
}
