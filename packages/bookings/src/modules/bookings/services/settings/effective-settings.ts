import type { EntityManager } from '@mikro-orm/core'
import type { WorkingCalendar } from '../../../../lib/pure-engine'
import type { IsoDate, Weekday } from '../../../../lib/time/types'
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

export type BookingsHolidayView = {
  date: IsoDate
  label: string | null
}

export type BookingsSettingsView = {
  isSaved: boolean
  timeZone: string | null
  freeWeekdays: Weekday[]
  holidays: BookingsHolidayView[]
  warningThresholdWorkingDays: number
  conflictPolicy: BookingConflictPolicy
  updatedAt: string | null
}

export const BOOKINGS_SETTINGS_DEFAULTS = {
  freeWeekdays: [6, 0] as readonly Weekday[],
  warningThresholdWorkingDays: 5,
  conflictPolicy: 'advisory' as BookingConflictPolicy,
}

export const FREE_WEEKDAY_COLUMNS = {
  0: 'freeOnSunday',
  1: 'freeOnMonday',
  2: 'freeOnTuesday',
  3: 'freeOnWednesday',
  4: 'freeOnThursday',
  5: 'freeOnFriday',
  6: 'freeOnSaturday',
} as const satisfies Record<Weekday, keyof BookingsSettings>

const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]

function freeWeekdaysOf(settings: BookingsSettings): Weekday[] {
  return WEEKDAYS.filter((weekday) => settings[FREE_WEEKDAY_COLUMNS[weekday]])
}

export async function loadBookingsSettings(em: EntityManager, scope: BookingsScope): Promise<BookingsSettings | null> {
  return em.findOne(BookingsSettings, { tenantId: scope.tenantId, organizationId: scope.organizationId })
}

export async function loadBookingsHolidays(em: EntityManager, scope: BookingsScope): Promise<BookingsHoliday[]> {
  return em.find(
    BookingsHoliday,
    { tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null },
    { orderBy: { holidayOn: 'asc' } }
  )
}

export async function readBookingsSettingsView(em: EntityManager, scope: BookingsScope): Promise<BookingsSettingsView> {
  const [settings, holidays] = await Promise.all([loadBookingsSettings(em, scope), loadBookingsHolidays(em, scope)])
  const holidayViews = holidays.map((holiday) => ({ date: holiday.holidayOn, label: holiday.label ?? null }))

  if (!settings) {
    return {
      isSaved: false,
      timeZone: null,
      freeWeekdays: [...BOOKINGS_SETTINGS_DEFAULTS.freeWeekdays],
      holidays: holidayViews,
      warningThresholdWorkingDays: BOOKINGS_SETTINGS_DEFAULTS.warningThresholdWorkingDays,
      conflictPolicy: BOOKINGS_SETTINGS_DEFAULTS.conflictPolicy,
      updatedAt: null,
    }
  }
  return {
    isSaved: true,
    timeZone: settings.timeZone,
    freeWeekdays: freeWeekdaysOf(settings),
    holidays: holidayViews,
    warningThresholdWorkingDays: settings.warningThresholdWorkingDays,
    conflictPolicy: settings.conflictPolicy,
    updatedAt: settings.updatedAt ? settings.updatedAt.toISOString() : null,
  }
}

export async function resolveEffectiveBookingsSettings(
  em: EntityManager,
  scope: BookingsScope
): Promise<EffectiveBookingsSettings> {
  const view = await readBookingsSettingsView(em, scope)
  return {
    calendar: { freeWeekdays: view.freeWeekdays, holidays: view.holidays.map((holiday) => holiday.date) },
    warningThresholdWorkingDays: view.warningThresholdWorkingDays,
    conflictPolicy: view.conflictPolicy,
    timeZone: view.timeZone,
  }
}
