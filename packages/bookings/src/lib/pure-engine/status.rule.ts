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
