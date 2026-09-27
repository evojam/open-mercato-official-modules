export const BOOKING_CONFLICT_POLICIES = ['advisory', 'reject'] as const

export type BookingConflictPolicy = (typeof BOOKING_CONFLICT_POLICIES)[number]

export type CategoryId = string

export type ConflictPolicyException = {
  categoryId: CategoryId
  mode: BookingConflictPolicy
}

const STRICTNESS: Record<BookingConflictPolicy, number> = { advisory: 0, reject: 1 }

export function isConflictPolicy(value: string): value is BookingConflictPolicy {
  return (BOOKING_CONFLICT_POLICIES as readonly string[]).includes(value)
}

export function resolveConflictPolicy(
  defaultPolicy: BookingConflictPolicy,
  exceptions: readonly ConflictPolicyException[],
  participantCategoryIds: readonly (CategoryId | null)[]
): BookingConflictPolicy {
  const byCategory = new Map(exceptions.map((exception) => [exception.categoryId, exception.mode]))
  const modes = participantCategoryIds.map((categoryId) =>
    categoryId === null ? defaultPolicy : byCategory.get(categoryId) ?? defaultPolicy
  )
  if (modes.length === 0) return defaultPolicy
  return modes.reduce((strictest, mode) => (STRICTNESS[mode] > STRICTNESS[strictest] ? mode : strictest))
}
