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

export type UnavailabilityWindow = Interval & {
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
  reasonLabel?: string
}

export type Conflict = OverlapConflict | UnavailabilityConflict

export type DetectConflictsInput = {
  placements: readonly Placement[]
  unavailability?: readonly UnavailabilityWindow[]
}
