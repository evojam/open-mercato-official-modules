import { z } from 'zod'
import { BOOKING_STATUSES } from '../../../../../lib/pure-engine'
import { isIsoDate } from '../../../../../lib/time/day-ranges'
import { recordIdSchema, scopeSchema } from '../shared.validators'

export const MAX_BOOKING_PARTICIPANTS = 10

export const MAX_BOOKING_WORKING_DAYS = 365

export const isoDateSchema = (message: string) => z.string().trim().refine(isIsoDate, { message })

const targetIdSchema = z.string().uuid({ message: 'bookings.bookings.errors.targetRequired' })

const subjectIdsSchema = z
  .array(z.string().uuid({ message: 'bookings.bookings.errors.subjectRequired' }))
  .min(1, { message: 'bookings.bookings.errors.subjectRequired' })
  .max(MAX_BOOKING_PARTICIPANTS)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'bookings.bookings.errors.subjectTwice' })

const durationValueSchema = z.coerce
  .number({ message: 'bookings.bookings.errors.duration' })
  .positive({ message: 'bookings.bookings.errors.duration' })
  .max(MAX_BOOKING_WORKING_DAYS, { message: 'bookings.bookings.errors.duration' })
  .refine((value) => Number.isInteger(value * 2), { message: 'bookings.bookings.errors.durationHalfDays' })

const expectedStartOnSchema = isoDateSchema('bookings.bookings.errors.expectedStart')

const startOnSchema = isoDateSchema('bookings.bookings.errors.startOn')

const noteSchema = z.string().trim().max(2000).nullable().optional()

export const bookingCreateSchema = scopeSchema
  .extend({
    targetId: targetIdSchema,
    subjectIds: subjectIdsSchema,
    durationValue: durationValueSchema,
    expectedStartOn: expectedStartOnSchema,
    startOn: startOnSchema.nullable().optional(),
    note: noteSchema,
  })
  .strict()

export type BookingCreateInput = z.output<typeof bookingCreateSchema>

const bookingIdSchema = scopeSchema.merge(recordIdSchema)

export const bookingPlaceSchema = bookingIdSchema.extend({ startOn: startOnSchema }).strict()

export type BookingPlaceInput = z.output<typeof bookingPlaceSchema>

export const bookingMoveSchema = bookingPlaceSchema

export type BookingMoveInput = z.output<typeof bookingMoveSchema>

export const bookingResizeSchema = bookingIdSchema.extend({ durationValue: durationValueSchema }).strict()

export type BookingResizeInput = z.output<typeof bookingResizeSchema>

export const bookingStatusSchema = bookingIdSchema
  .extend({ status: z.enum(BOOKING_STATUSES, { message: 'bookings.bookings.errors.statusRequired' }) })
  .strict()

export type BookingStatusInput = z.output<typeof bookingStatusSchema>

export const bookingUpdateSchema = bookingIdSchema
  .extend({
    targetId: targetIdSchema.optional(),
    subjectIds: subjectIdsSchema.optional(),
    expectedStartOn: expectedStartOnSchema.optional(),
    note: noteSchema,
  })
  .strict()
  .refine(
    (input) => [input.targetId, input.subjectIds, input.expectedStartOn, input.note].some((value) => value !== undefined),
    { message: 'bookings.bookings.errors.nothingToUpdate' }
  )

export type BookingUpdateInput = z.output<typeof bookingUpdateSchema>
