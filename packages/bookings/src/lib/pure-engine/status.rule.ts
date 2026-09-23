export const BOOKING_STATUSES = ['planned', 'active', 'completed', 'cancelled', 'no_show'] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const OPEN_BOOKING_STATUSES = ['planned', 'active'] as const satisfies readonly BookingStatus[]

export function isOpen(status: BookingStatus): boolean {
  return (OPEN_BOOKING_STATUSES as readonly BookingStatus[]).includes(status)
}

export function isClosed(status: BookingStatus): boolean {
  return !isOpen(status)
}
