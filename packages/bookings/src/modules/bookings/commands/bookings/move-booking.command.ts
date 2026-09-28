import { isClosed } from '../../../../lib/pure-engine'
import { bookingMoveSchema } from '../../data/validators'
import type { BookingMoveInput } from '../../data/validators'
import { bookingsErrors } from '../../lib/errors'
import { placementFor, registerBookingWriteCommand, windowFor } from '../shared/booking-write.commands'

export const moveBookingCommand = registerBookingWriteCommand<BookingMoveInput>({
  commandId: 'bookings.bookings.move',
  schema: bookingMoveSchema,
  label: ['bookings.audit.bookings.move', 'Move booking'],
  async plan(_em, _scope, loaded, input) {
    const { booking } = loaded
    if (isClosed(booking.status)) throw bookingsErrors.bookingClosed(booking.status)
    if (!booking.startAt) throw bookingsErrors.bookingNotPlaced()
    const placement = placementFor(loaded, { startOn: input.startOn })
    return {
      event: 'bookings.booking.moved',
      warnings: placement.startsOnFreeDay ? ['start_on_free_day'] : [],
      write: {
        targetId: booking.target.id,
        window: windowFor(loaded, placement.days),
        apply: () => {
          booking.startAt = placement.startAt
          booking.endAt = placement.endAt
          booking.updatedAt = new Date()
        },
      },
    }
  },
})
