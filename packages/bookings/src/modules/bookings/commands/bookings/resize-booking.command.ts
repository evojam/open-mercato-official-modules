import { isClosed } from '../../../../lib/pure-engine'
import { bookingResizeSchema } from '../../data/validators'
import type { BookingResizeInput } from '../../data/validators'
import { bookingsErrors } from '../../lib/errors'
import { currentDays } from '../../services/bookings/booking-loader'
import { placementFor, registerBookingWriteCommand, windowFor } from '../shared/booking-write.commands'

export const resizeBookingCommand = registerBookingWriteCommand<BookingResizeInput>({
  commandId: 'bookings.bookings.resize',
  schema: bookingResizeSchema,
  label: ['bookings.audit.bookings.resize', 'Change booking length'],
  async plan(_em, _scope, loaded, input) {
    const { booking } = loaded
    if (isClosed(booking.status)) throw bookingsErrors.bookingClosed(booking.status)
    const days = currentDays(booking)
    const placement = days ? placementFor(loaded, { startOn: days.from, durationWorkingDays: input.durationValue }) : null
    return {
      event: 'bookings.booking.resized',
      write: {
        targetId: booking.target.id,
        window: placement ? windowFor(loaded, placement.days) : null,
        apply: () => {
          booking.durationValue = String(input.durationValue)
          if (placement) booking.endAt = placement.endAt
          booking.updatedAt = new Date()
        },
      },
    }
  },
})
