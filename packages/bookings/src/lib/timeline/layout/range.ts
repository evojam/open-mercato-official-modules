import { isWorkingDay } from '../../pure-engine/working-days.rule'
import type { WorkingCalendar } from '../../pure-engine/working-days.rule'
import { addDays, daysBetween, isIsoDate } from '../../time/date-fns.adapter'
import type { DayRange, IsoDate } from '../../time/types'

export const DEFAULT_DAYS_BACK = 2

export const DEFAULT_TIMELINE_DAYS = 7

export const MAX_TIMELINE_DAYS = 366

export type FreeDay = {
  date: IsoDate
  kind: 'weekend' | 'holiday'
}

export function defaultTimelineRange(today: IsoDate): DayRange {
  const from = addDays(today, -DEFAULT_DAYS_BACK)
  return { from, to: addDays(from, DEFAULT_TIMELINE_DAYS) }
}

export function isTimelineRangeAllowed(range: DayRange): boolean {
  if (!isIsoDate(range.from) || !isIsoDate(range.to)) return false
  const span = daysBetween(range.from, range.to)
  return span > 0 && span <= MAX_TIMELINE_DAYS
}

export function isSameRange(a: DayRange, b: DayRange): boolean {
  return a.from === b.from && a.to === b.to
}

export function rangeThrough(first: IsoDate, last: IsoDate): DayRange {
  return { from: first, to: addDays(last, 1) }
}

export function lastDayOf(range: DayRange): IsoDate {
  return addDays(range.to, -1)
}

export function daysIn(range: DayRange): IsoDate[] {
  return Array.from({ length: Math.max(daysBetween(range.from, range.to), 0) }, (_, offset) =>
    addDays(range.from, offset)
  )
}

export function freeDaysIn(range: DayRange, calendar: WorkingCalendar): FreeDay[] {
  const holidays = new Set(calendar.holidays)
  return daysIn(range)
    .filter((date) => !isWorkingDay(date, calendar))
    .map((date) => ({ date, kind: holidays.has(date) ? 'holiday' : 'weekend' }))
}
