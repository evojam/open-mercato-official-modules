import type { EntityManager } from '@mikro-orm/postgresql'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import type { BookingConflictPolicy, BookingStatus, Conflict } from '../../../../lib/pure-engine'
import type { DayRange } from '../../../../lib/time/types'
import { Booking, BookingParticipant } from '../../data/entities'
import type { BookingSubject } from '../../data/entities'
import { bookingsErrors } from '../../lib/errors'
import type { BookingsScope } from '../settings/effective-settings'
import { findConflicts } from './conflict-check.service'
import { lockSubjects, lockTarget } from './subject-lock'

export type OccupiedWindow = {
  bookingId: string
  targetId: string
  targetName: string
  subjectIds: readonly string[]
  days: DayRange
  status: BookingStatus
  policy: BookingConflictPolicy
}

export type BookingWrite = {
  targetId: string
  window: OccupiedWindow | null
  apply: () => void | Promise<void>
}

async function guardWindow(em: EntityManager, scope: BookingsScope, window: OccupiedWindow): Promise<Conflict[]> {
  await lockSubjects(em, window.subjectIds)
  const conflicts = await findConflicts(em, scope, {
    bookingId: window.bookingId,
    targetId: window.targetId,
    targetName: window.targetName,
    subjectIds: window.subjectIds,
    days: window.days,
    status: window.status,
  })
  if (window.policy === 'reject' && conflicts.some((conflict) => conflict.kind === 'overlap')) {
    throw bookingsErrors.bookingConflict(conflicts)
  }
  return conflicts
}

export async function writeBooking(em: EntityManager, scope: BookingsScope, write: BookingWrite): Promise<Conflict[]> {
  let conflicts: Conflict[] = []
  await withAtomicFlush(
    em,
    [
      async () => {
        await lockTarget(em, write.targetId)
        if (write.window) conflicts = await guardWindow(em, scope, write.window)
      },
      write.apply,
    ],
    { transaction: true }
  )
  return conflicts
}

export function syncParticipants(
  em: EntityManager,
  scope: BookingsScope,
  booking: Booking,
  current: readonly BookingParticipant[],
  wanted: readonly BookingSubject[]
): void {
  const now = new Date()
  const wantedIds = new Set(wanted.map((subject) => subject.id))
  const currentIds = new Set(current.map((participant) => participant.subject.id))
  for (const participant of current) {
    if (wantedIds.has(participant.subject.id)) continue
    participant.deletedAt = now
    participant.updatedAt = now
  }
  for (const subject of wanted) {
    if (currentIds.has(subject.id)) continue
    em.persist(em.create(BookingParticipant, { ...scope, booking, subject, role: 'performer' }))
  }
}
