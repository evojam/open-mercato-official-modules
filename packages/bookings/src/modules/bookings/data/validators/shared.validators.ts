import { z } from 'zod'
import { HEX_COLOR } from '../../../../lib/timeline/palette'
import { isValidTimeZone, normalizeTimeZone } from '../../../../lib/time/day-ranges'

const BARE_OFFSET = /^(?:[+-]\d|(?:GMT|UTC)[+-]|Etc\/GMT[+-])/i

export const timeZoneSchema = z
  .string()
  .trim()
  .refine((zone) => !BARE_OFFSET.test(zone), { message: 'bookings.errors.timeZoneOffset', abort: true })
  .refine(isValidTimeZone, { message: 'bookings.errors.timeZoneUnknown', abort: true })
  .transform(normalizeTimeZone)

export const colorSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(HEX_COLOR, { message: 'bookings.errors.color' })

export const nameSchema = z
  .string()
  .trim()
  .min(1, { message: 'bookings.errors.nameRequired' })
  .max(200, { message: 'bookings.errors.nameTooLong' })

export const scopeSchema = z.object({
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid(),
})

export const recordIdSchema = z.object({ id: z.string().uuid() })
