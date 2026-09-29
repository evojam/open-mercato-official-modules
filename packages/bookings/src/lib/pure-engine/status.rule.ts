export const BOOKING_STATUSES = ['planned', 'active', 'completed', 'cancelled', 'no_show'] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

const HOLDS_THE_SLOT = {
  planned: true,
  active: true,
  completed: false,
  cancelled: false,
  no_show: false,
} as const satisfies Record<BookingStatus, boolean>

export type OpenBookingStatus = {
  [K in BookingStatus]: (typeof HOLDS_THE_SLOT)[K] extends true ? K : never
}[BookingStatus]

export const OPEN_BOOKING_STATUSES = BOOKING_STATUSES.filter(
  (status): status is OpenBookingStatus => HOLDS_THE_SLOT[status]
)

export function isOpen(status: BookingStatus): boolean {
  return HOLDS_THE_SLOT[status]
}

export function isClosed(status: BookingStatus): boolean {
  return !isOpen(status)
}

export const NEXT_BOOKING_STATUSES = {
  planned: ['active', 'completed', 'cancelled', 'no_show'],
  active: ['completed', 'cancelled', 'no_show'],
  completed: ['planned', 'active'],
  no_show: ['planned', 'active'],
  cancelled: [],
} as const satisfies Record<BookingStatus, readonly BookingStatus[]>

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return (NEXT_BOOKING_STATUSES[from] as readonly BookingStatus[]).includes(to)
}

export function reopens(from: BookingStatus, to: BookingStatus): boolean {
  return isClosed(from) && isOpen(to)
}
