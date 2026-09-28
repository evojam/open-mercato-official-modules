import { z } from 'zod'
import { isIsoDate } from '../../../../../lib/time/day-ranges'
import { scopeSchema } from '../shared.validators'

export const MAX_BOOKING_PARTICIPANTS = 10

export const MAX_BOOKING_WORKING_DAYS = 365

const isoDateSchema = (message: string) => z.string().trim().refine(isIsoDate, { message })

export const bookingCreateSchema = scopeSchema
  .extend({
    targetId: z.string().uuid({ message: 'bookings.bookings.errors.targetRequired' }),
    subjectIds: z
      .array(z.string().uuid({ message: 'bookings.bookings.errors.subjectRequired' }))
      .min(1, { message: 'bookings.bookings.errors.subjectRequired' })
      .max(MAX_BOOKING_PARTICIPANTS)
      .refine((ids) => new Set(ids).size === ids.length, { message: 'bookings.bookings.errors.subjectTwice' }),
    durationValue: z.coerce
      .number({ message: 'bookings.bookings.errors.duration' })
      .positive({ message: 'bookings.bookings.errors.duration' })
      .max(MAX_BOOKING_WORKING_DAYS, { message: 'bookings.bookings.errors.duration' })
      .refine((value) => Number.isInteger(value * 2), { message: 'bookings.bookings.errors.durationHalfDays' }),
    expectedStartOn: isoDateSchema('bookings.bookings.errors.expectedStart'),
    startOn: isoDateSchema('bookings.bookings.errors.startOn').nullable().optional(),
    note: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()

export type BookingCreateInput = z.output<typeof bookingCreateSchema>
