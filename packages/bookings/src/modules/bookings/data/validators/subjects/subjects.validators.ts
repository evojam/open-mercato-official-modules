import { z } from 'zod'
import { nameSchema, recordIdSchema, scopeSchema, timeZoneSchema } from '../shared.validators'

const providerKeySchema = z
  .string()
  .trim()
  .min(1, { message: 'bookings.subjects.errors.providerRequired' })
  .max(64)

const placementFields = {
  categoryId: z.string().uuid({ message: 'bookings.subjects.errors.category' }).nullable().optional(),
  timeZone: timeZoneSchema.optional(),
}

export const bookingSubjectAddSchema = z.discriminatedUnion('mode', [
  scopeSchema
    .extend({
      mode: z.literal('existing'),
      providerKey: providerKeySchema,
      providerRecordId: z.string().trim().min(1, { message: 'bookings.subjects.errors.recordRequired' }).max(200),
      ...placementFields,
    })
    .strict(),
  scopeSchema
    .extend({
      mode: z.literal('new'),
      providerKey: providerKeySchema,
      name: nameSchema,
      ...placementFields,
    })
    .strict(),
])

export const bookingSubjectUpdateSchema = scopeSchema
  .merge(recordIdSchema)
  .extend({
    ...placementFields,
    isActive: z.boolean().optional(),
  })
  .strict()

export type BookingSubjectAddInput = z.output<typeof bookingSubjectAddSchema>
export type BookingSubjectUpdateInput = z.output<typeof bookingSubjectUpdateSchema>
