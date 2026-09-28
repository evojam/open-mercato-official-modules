import { BOOKING_RESOURCE_KIND } from '../../../../commands/shared/booking-write.commands'
import { bookingStatusSchema } from '../../../../data/validators'
import { makeCommandActionRoute } from '../../../../lib/command-action-route'
import { bookingWriteResponseSchema, errorResponseSchema } from '../../../openapi'

const route = makeCommandActionRoute({
  commandId: 'bookings.bookings.change-status',
  schema: bookingStatusSchema,
  feature: 'bookings.manage_bookings',
  resourceKind: BOOKING_RESOURCE_KIND,
  summary: 'Change the status of a booking',
  description:
    'Moves the booking along the status matrix; cancel is the status "cancelled". Closing frees the slot; reopening a placed booking runs the conflict check again and can be refused under reject.',
  responseSchema: bookingWriteResponseSchema,
  errorSchema: errorResponseSchema,
})

export const metadata = route.metadata
export const POST = route.POST
export const openApi = route.openApi
