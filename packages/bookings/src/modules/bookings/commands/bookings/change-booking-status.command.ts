import { canTransition, reopens } from '../../../../lib/pure-engine'
import { bookingStatusSchema } from '../../data/validators'
import type { BookingStatusInput } from '../../data/validators'
import { bookingsErrors } from '../../lib/errors'
import { currentDays } from '../../services/bookings/booking-loader'
import { registerBookingWriteCommand, windowFor } from '../shared/booking-write.commands'

export const changeBookingStatusCommand = registerBookingWriteCommand<BookingStatusInput>({
  commandId: 'bookings.bookings.change-status',
  schema: bookingStatusSchema,
  label: ['bookings.audit.bookings.status', 'Change booking status'],
  async plan(_em, _scope, loaded, input) {
    const { booking } = loaded
    const from = booking.status
    if (!canTransition(from, input.status)) throw bookingsErrors.invalidTransition(from, input.status)
    const days = reopens(from, input.status) ? currentDays(booking) : null
    return {
      event: input.status === 'cancelled' ? 'bookings.booking.cancelled' : 'bookings.booking.updated',
      write: {
        targetId: booking.target.id,
        window: days ? windowFor(loaded, days, { status: input.status }) : null,
        apply: () => {
          booking.status = input.status
          booking.updatedAt = new Date()
        },
      },
    }
  },
})
