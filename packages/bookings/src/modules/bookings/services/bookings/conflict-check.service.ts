import type { EntityManager } from '@mikro-orm/postgresql'
import { detectConflicts } from '../../../../lib/pure-engine'
import type { BookingStatus, Conflict, Placement } from '../../../../lib/pure-engine'
import { bookingDays, candidateWindow } from '../../../../lib/time/day-ranges'
import type { DayRange } from '../../../../lib/time/types'
import { BookingParticipant, OPEN_BOOKING_STATUSES } from '../../data/entities'
import type { BookingsScope } from '../settings/effective-settings'

export type ConflictCandidate = {
  bookingId?: string
  targetId?: string
  targetName?: string
  subjectIds: readonly string[]
  days: DayRange
  status: BookingStatus
}

const PREVIEW_BOOKING_ID = 'preview'

export async function findConflicts(
  em: EntityManager,
  scope: BookingsScope,
  candidate: ConflictCandidate
): Promise<Conflict[]> {
  const window = candidateWindow(candidate.days)
  const candidateId = candidate.bookingId ?? PREVIEW_BOOKING_ID
  const others = await em.find(
    BookingParticipant,
    {
      ...scope,
      deletedAt: null,
      subject: { $in: [...candidate.subjectIds] },
      booking: {
        deletedAt: null,
        ...(candidate.bookingId ? { id: { $ne: candidate.bookingId } } : {}),
        status: { $in: [...OPEN_BOOKING_STATUSES] },
        startAt: { $lt: window.to },
        endAt: { $gt: window.from },
      },
    },
    { populate: ['booking', 'booking.target'] }
  )

  const placements: Placement[] = [
    ...candidate.subjectIds.map((subjectId) => ({
      ...candidate.days,
      bookingId: candidateId,
      subjectId,
      status: candidate.status,
      targetId: candidate.targetId,
      targetName: candidate.targetName,
    })),
    ...others.flatMap((participant) => {
      const { booking } = participant
      const days =
        booking.startAt && booking.endAt
          ? bookingDays({ from: booking.startAt, to: booking.endAt }, booking.target.timeZone)
          : null
      if (!days) return []
      return [
        {
          ...days,
          bookingId: booking.id,
          subjectId: participant.subject.id,
          status: booking.status,
          targetId: booking.target.id,
          targetName: booking.target.name,
        },
      ]
    }),
  ]
  return detectConflicts({ placements }).filter((conflict) => conflict.bookingId === candidateId)
}
