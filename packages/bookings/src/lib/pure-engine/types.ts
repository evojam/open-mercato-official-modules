import type { DayRange } from '../time/types'
import type { BookingStatus } from './status.rule'

export type SubjectId = string

export type BookingId = string

export type Placement = DayRange & {
  bookingId: BookingId
  subjectId: SubjectId
  status: BookingStatus
  targetName?: string
}

export type UnavailabilityWindow = DayRange & {
  windowId: string
  subjectId: SubjectId
  reasonLabel?: string
}

export type OverlapConflict = DayRange & {
  kind: 'overlap'
  subjectId: SubjectId
  bookingId: BookingId
  withBookingId: BookingId
  withTargetName?: string
}

export type UnavailabilityConflict = DayRange & {
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
