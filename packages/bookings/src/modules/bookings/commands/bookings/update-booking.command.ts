import { isClosed } from '../../../../lib/pure-engine'
import { bookingUpdateSchema } from '../../data/validators'
import type { BookingUpdateInput } from '../../data/validators'
import { bookingsErrors } from '../../lib/errors'
import { currentDays, loadSubjects, loadTarget } from '../../services/bookings/booking-loader'
import { syncParticipants } from '../../services/bookings/reschedule.service'
import { placementFor, registerBookingWriteCommand, windowFor } from '../shared/booking-write.commands'

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const sortedB = [...b].sort()
  return [...a].sort().every((id, index) => id === sortedB[index])
}

export const updateBookingCommand = registerBookingWriteCommand<BookingUpdateInput>({
  commandId: 'bookings.bookings.update',
  schema: bookingUpdateSchema,
  label: ['bookings.audit.bookings.update', 'Update booking'],
  async plan(em, scope, loaded, input) {
    const { booking, participants } = loaded
    if (isClosed(booking.status)) throw bookingsErrors.bookingClosed(booking.status)
    const target =
      input.targetId && input.targetId !== booking.target.id ? await loadTarget(em, scope, input.targetId) : booking.target
    const currentSubjects = participants.map((participant) => participant.subject)
    const subjects = input.subjectIds ? await loadSubjects(em, scope, input.subjectIds) : currentSubjects
    const occupancyChanged =
      target !== booking.target || !sameIds(subjects.map((subject) => subject.id), currentSubjects.map((subject) => subject.id))
    const days = occupancyChanged ? currentDays(booking) : null
    const placement = days ? placementFor(loaded, { startOn: days.from, target }) : null
    return {
      event: 'bookings.booking.updated',
      write: {
        targetId: target.id,
        window: placement ? windowFor(loaded, placement.days, { subjects, target }) : null,
        apply: () => {
          booking.target = target
          if (placement) {
            booking.startAt = placement.startAt
            booking.endAt = placement.endAt
          }
          if (input.expectedStartOn !== undefined) booking.expectedStartOn = input.expectedStartOn
          if (input.note !== undefined) booking.note = input.note
          booking.updatedAt = new Date()
          syncParticipants(em, scope, booking, participants, subjects)
        },
      },
    }
  },
})
