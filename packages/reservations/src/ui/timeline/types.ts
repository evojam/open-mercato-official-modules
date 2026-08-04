export type SubjectType = 'resource' | 'ruleset'
export type ReservationStatus = 'planned' | 'active' | 'done' | 'cancelled'

export type SubjectCategory = {
  id: string
  label: string
  color?: string
  icon?: string
}

export type SubjectRow = {
  subjectType: SubjectType
  subjectId: string
  label: string
  category: SubjectCategory
  isActive: boolean
}

export type TimelineReservationItem = {
  id: string
  subjectType: SubjectType
  subjectId: string
  subjectLabel: string
  targetId: string | null
  targetName: string
  durationWorkingDays: number
  latestStart: string | null
  status: ReservationStatus
  placement: { startAt: string; endAt: string } | null
  note: string | null
  updatedAt: string
  conflict: boolean
}

export type UnavailabilityWindow = {
  startAt: string
  endAt: string
  reasonLabel?: string
}

export type TimelineRow = {
  subject: SubjectRow
  reservations: TimelineReservationItem[]
  unavailability: UnavailabilityWindow[]
}

export type ReservationsTimelineProps = {
  rows: TimelineRow[]
  window: { from: string; to: string }
  timezone: string
  offWeekdays?: number[]
  holidays?: string[]
  selectedReservationId?: string | null
  onSelectReservation?: (id: string | null) => void
  labels?: Record<string, string>
  editable?: boolean
  onItemMove?: (id: string, startAt: string) => void
  onItemResize?: (id: string, durationWorkingDays: number) => void
}
