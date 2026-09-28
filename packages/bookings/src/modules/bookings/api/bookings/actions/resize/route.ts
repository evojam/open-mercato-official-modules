import { BOOKING_RESOURCE_KIND } from '../../../../commands/shared/booking-write.commands'
import { bookingResizeSchema } from '../../../../data/validators'
import { makeCommandActionRoute } from '../../../../lib/command-action-route'
import { bookingWriteResponseSchema, errorResponseSchema } from '../../../openapi'

const route = makeCommandActionRoute({
  commandId: 'bookings.bookings.resize',
  schema: bookingResizeSchema,
  feature: 'bookings.manage_bookings',
  resourceKind: BOOKING_RESOURCE_KIND,
  summary: 'Change the working days of a booking',
  description:
    'Sets a new number of working days; a placed booking keeps its start and gets a new end. Refused for a closed booking, and under reject for a clash.',
  responseSchema: bookingWriteResponseSchema,
  errorSchema: errorResponseSchema,
})

export const metadata = route.metadata
export const POST = route.POST
export const openApi = route.openApi
