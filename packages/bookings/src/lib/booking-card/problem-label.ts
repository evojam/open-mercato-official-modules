import type { Conflict } from '../pure-engine'

export type BookingProblemKind = 'overlap_other_target' | 'overlap_same_target' | 'unavailability'

type Translate = (key: string, fallback: string) => string

const BY_URGENCY: readonly BookingProblemKind[] = ['overlap_other_target', 'overlap_same_target', 'unavailability']

const FALLBACKS: Record<BookingProblemKind, string> = {
  overlap_other_target: 'Needed at several targets at once',
  overlap_same_target: 'Booked more than once',
  unavailability: 'Booked while unavailable',
}

export function problemKindsOf(conflicts: readonly Conflict[], targetId: string): BookingProblemKind[] {
  return conflicts.map((conflict) => {
    if (conflict.kind === 'unavailability') return 'unavailability'
    return conflict.withTargetId === targetId ? 'overlap_same_target' : 'overlap_other_target'
  })
}

export function leadingProblemKind(kinds: readonly BookingProblemKind[]): BookingProblemKind | null {
  return BY_URGENCY.find((kind) => kinds.includes(kind)) ?? null
}

export function problemSeverity(kinds: readonly BookingProblemKind[]): number {
  const leading = leadingProblemKind(kinds)
  return leading === null ? BY_URGENCY.length : BY_URGENCY.indexOf(leading)
}

export function problemLabel(kind: BookingProblemKind, t: Translate): string {
  return t(`bookings.problems.${kind}`, FALLBACKS[kind])
}
