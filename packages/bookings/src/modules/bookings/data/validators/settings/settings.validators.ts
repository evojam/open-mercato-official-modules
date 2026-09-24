import { z } from 'zod'
import { canonicalTimeZone, isIsoDate, isValidTimeZone } from '../../../../../lib/time/day-ranges'
import { BOOKING_CONFLICT_POLICIES } from '../../../../../lib/pure-engine/conflict-policy.rule'

const BARE_OFFSET = /^(?:[+-]\d|(?:GMT|UTC)[+-]|Etc\/GMT[+-])/i

export const MAX_WARNING_THRESHOLD_WORKING_DAYS = 250

const THRESHOLD_ERROR = 'bookings.settings.errors.threshold'

const timeZoneSchema = z
  .string()
  .trim()
  .refine((zone) => !BARE_OFFSET.test(zone), { message: 'bookings.settings.errors.timeZoneOffset', abort: true })
  .refine(isValidTimeZone, { message: 'bookings.settings.errors.timeZoneUnknown', abort: true })
  .transform(canonicalTimeZone)

const holidaySchema = z
  .object({
    date: z.string().refine(isIsoDate, { message: 'bookings.settings.errors.holidayDate' }),
    label: z.string().trim().max(120, { message: 'bookings.settings.errors.holidayLabel' }).nullable().optional(),
  })
  .strict()

export const bookingsSettingsUpdateSchema = z
  .object({
    timeZone: timeZoneSchema.optional(),
    freeWeekdays: z
      .array(z.number().int().min(0).max(6))
      .refine((days) => new Set(days).size === days.length, { message: 'bookings.settings.errors.freeWeekdaysDuplicate' })
      .refine((days) => days.length < 7, { message: 'bookings.settings.errors.noWorkingDay' })
      .optional(),
    holidays: z
      .array(holidaySchema)
      .max(1000, { message: 'bookings.settings.errors.holidaysTooMany' })
      .refine((holidays) => new Set(holidays.map((holiday) => holiday.date)).size === holidays.length, {
        message: 'bookings.settings.errors.holidayDuplicate',
      })
      .optional(),
    warningThresholdWorkingDays: z
      .number({ message: THRESHOLD_ERROR })
      .int({ message: THRESHOLD_ERROR })
      .min(0, { message: THRESHOLD_ERROR })
      .max(MAX_WARNING_THRESHOLD_WORKING_DAYS, { message: THRESHOLD_ERROR })
      .optional(),
    conflictPolicy: z.enum(BOOKING_CONFLICT_POLICIES).optional(),
  })
  .strict()

export const bookingsSettingsSaveSchema = bookingsSettingsUpdateSchema
  .extend({
    tenantId: z.string().uuid(),
    organizationId: z.string().uuid(),
  })
  .strict()

export type BookingsSettingsUpdateInput = z.input<typeof bookingsSettingsUpdateSchema>
export type BookingsSettingsSaveInput = z.output<typeof bookingsSettingsSaveSchema>
