export const BOOKING_CONFLICT_POLICIES = ['advisory', 'reject'] as const

export type BookingConflictPolicy = (typeof BOOKING_CONFLICT_POLICIES)[number]

export function isConflictPolicy(value: string): value is BookingConflictPolicy {
  return (BOOKING_CONFLICT_POLICIES as readonly string[]).includes(value)
}
