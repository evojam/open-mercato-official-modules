import { BOOKING_RESOURCE_KIND } from '../../../../commands/shared/booking-write.commands'
import { bookingMoveSchema } from '../../../../data/validators'
import { makeCommandActionRoute } from '../../../../lib/command-action-route'
import { bookingWriteResponseSchema, errorResponseSchema } from '../../../openapi'

const route = makeCommandActionRoute({
  commandId: 'bookings.bookings.move',
  schema: bookingMoveSchema,
  feature: 'bookings.manage_bookings',
  resourceKind: BOOKING_RESOURCE_KIND,
  summary: 'Move a booking to another start day',
  description:
    'Keeps the working days and recomputes the window from the new start in the target zone. Refused for a closed or unplaced booking, and under reject for a clash.',
  responseSchema: bookingWriteResponseSchema,
  errorSchema: errorResponseSchema,
})

export const metadata = route.metadata
export const POST = route.POST
export const openApi = route.openApi
