import { z } from 'zod'
import { colorSchema, nameSchema, recordIdSchema, scopeSchema } from '../shared.validators'

const ICON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const iconSchema = z
  .string()
  .trim()
  .max(64, { message: 'bookings.categories.errors.icon' })
  .regex(ICON_NAME, { message: 'bookings.categories.errors.icon' })

export const bookingCategoryCreateSchema = scopeSchema
  .extend({
    name: nameSchema,
    icon: iconSchema.nullable().optional(),
    color: colorSchema.optional(),
  })
  .strict()

export const bookingCategoryUpdateSchema = scopeSchema
  .merge(recordIdSchema)
  .extend({
    name: nameSchema.optional(),
    icon: iconSchema.nullable().optional(),
    color: colorSchema.optional(),
  })
  .strict()

export type BookingCategoryCreateInput = z.output<typeof bookingCategoryCreateSchema>
export type BookingCategoryUpdateInput = z.output<typeof bookingCategoryUpdateSchema>
export type BookingCategoryFormInput = z.input<typeof bookingCategoryCreateSchema>
