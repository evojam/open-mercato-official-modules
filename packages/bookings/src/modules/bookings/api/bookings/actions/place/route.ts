import { BOOKING_RESOURCE_KIND } from '../../../../commands/shared/booking-write.commands'
import { bookingPlaceSchema } from '../../../../data/validators'
import { makeCommandActionRoute } from '../../../../lib/command-action-route'
import { bookingWriteResponseSchema, errorResponseSchema } from '../../../openapi'

const route = makeCommandActionRoute({
  commandId: 'bookings.bookings.place',
  schema: bookingPlaceSchema,
  feature: 'bookings.manage_bookings',
  resourceKind: BOOKING_RESOURCE_KIND,
  summary: 'Place a booking on the timeline',
  description:
    'Gives a booking without dates its start day; the end follows from the working days in the target zone. Refused for a closed or already placed booking, and under reject for a clash.',
  responseSchema: bookingWriteResponseSchema,
  errorSchema: errorResponseSchema,
})

export const metadata = route.metadata
export const POST = route.POST
export const openApi = route.openApi
