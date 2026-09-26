import { z } from 'zod'
import { colorSchema, nameSchema, recordIdSchema, scopeSchema, timeZoneSchema } from '../shared.validators'

export const bookingTargetCreateSchema = scopeSchema
  .extend({
    name: nameSchema,
    timeZone: timeZoneSchema.optional(),
    color: colorSchema.optional(),
  })
  .strict()

export const bookingTargetUpdateSchema = scopeSchema
  .merge(recordIdSchema)
  .extend({
    name: nameSchema.optional(),
    timeZone: timeZoneSchema.optional(),
    color: colorSchema.optional(),
  })
  .strict()

export type BookingTargetCreateInput = z.output<typeof bookingTargetCreateSchema>
export type BookingTargetUpdateInput = z.output<typeof bookingTargetUpdateSchema>
export type BookingTargetFormInput = z.input<typeof bookingTargetCreateSchema>
