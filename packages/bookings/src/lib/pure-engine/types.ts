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

// Caller-normalised: `from` and `to` are day boundaries in the organization's zone, never the
// raw instants planner stores. A window kept in UTC would flag the neighbouring day for every
// zone east of UTC (spec §8).
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
