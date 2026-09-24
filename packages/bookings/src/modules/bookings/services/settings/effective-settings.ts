import type { EntityManager } from '@mikro-orm/core'
import type { WorkingCalendar } from '../../../../lib/pure-engine'
import type { Weekday } from '../../../../lib/time/types'
import { BookingsHoliday, BookingsSettings } from '../../data/entities'
import type { BookingConflictPolicy } from '../../data/entities'

export type BookingsScope = {
  tenantId: string
  organizationId: string
}

export type EffectiveBookingsSettings = {
  calendar: WorkingCalendar
  warningThresholdWorkingDays: number
  conflictPolicy: BookingConflictPolicy
  timeZone: string | null
}

export const BOOKINGS_SETTINGS_DEFAULTS = {
  freeWeekdays: [6, 0] as readonly Weekday[],
  warningThresholdWorkingDays: 5,
  conflictPolicy: 'advisory' as BookingConflictPolicy,
}

function freeWeekdaysOf(settings: BookingsSettings): Weekday[] {
  const flags: Array<[Weekday, boolean]> = [
    [0, settings.freeOnSunday],
    [1, settings.freeOnMonday],
    [2, settings.freeOnTuesday],
    [3, settings.freeOnWednesday],
    [4, settings.freeOnThursday],
    [5, settings.freeOnFriday],
    [6, settings.freeOnSaturday],
  ]
  return flags.filter(([, free]) => free).map(([weekday]) => weekday)
}

export async function loadBookingsSettings(em: EntityManager, scope: BookingsScope): Promise<BookingsSettings | null> {
  return em.findOne(BookingsSettings, { tenantId: scope.tenantId, organizationId: scope.organizationId })
}

export async function resolveEffectiveBookingsSettings(
  em: EntityManager,
  scope: BookingsScope
): Promise<EffectiveBookingsSettings> {
  const [settings, holidays] = await Promise.all([
    loadBookingsSettings(em, scope),
    em.find(BookingsHoliday, { tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null }),
  ])
  const holidayDates = holidays.map((holiday) => holiday.holidayOn)

  if (!settings) {
    return {
      calendar: { freeWeekdays: BOOKINGS_SETTINGS_DEFAULTS.freeWeekdays, holidays: holidayDates },
      warningThresholdWorkingDays: BOOKINGS_SETTINGS_DEFAULTS.warningThresholdWorkingDays,
      conflictPolicy: BOOKINGS_SETTINGS_DEFAULTS.conflictPolicy,
      timeZone: null,
    }
  }
  return {
    calendar: { freeWeekdays: freeWeekdaysOf(settings), holidays: holidayDates },
    warningThresholdWorkingDays: settings.warningThresholdWorkingDays,
    conflictPolicy: settings.conflictPolicy,
    timeZone: settings.timeZone,
  }
}
