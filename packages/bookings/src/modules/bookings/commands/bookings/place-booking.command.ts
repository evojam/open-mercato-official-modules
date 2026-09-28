import { isClosed } from '../../../../lib/pure-engine'
import { bookingPlaceSchema } from '../../data/validators'
import type { BookingPlaceInput } from '../../data/validators'
import { bookingsErrors } from '../../lib/errors'
import { placementFor, registerBookingWriteCommand, windowFor } from '../shared/booking-write.commands'

export const placeBookingCommand = registerBookingWriteCommand<BookingPlaceInput>({
  commandId: 'bookings.bookings.place',
  schema: bookingPlaceSchema,
  label: ['bookings.audit.bookings.place', 'Place booking'],
  async plan(_em, _scope, loaded, input) {
    const { booking } = loaded
    if (isClosed(booking.status)) throw bookingsErrors.bookingClosed(booking.status)
    if (booking.startAt) throw bookingsErrors.bookingAlreadyPlaced()
    const placement = placementFor(loaded, { startOn: input.startOn })
    return {
      event: 'bookings.booking.placed',
      warnings: placement.startsOnFreeDay ? ['start_on_free_day'] : [],
      write: {
        targetId: booking.target.id,
        window: windowFor(loaded, placement.days),
        apply: () => {
          booking.startAt = placement.startAt
          booking.endAt = placement.endAt
          booking.lastWarnedWorkingDays = null
          booking.updatedAt = new Date()
        },
      },
    }
  },
})
