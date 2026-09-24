import { addDays, daysBetween, weekdayOf } from '../time/date-fns.adapter'
import type { IsoDate, Weekday } from '../time/types'

export type WorkingCalendar = {
  readonly freeWeekdays: readonly Weekday[]
  readonly holidays: readonly IsoDate[]
}

export function isWorkingDay(date: IsoDate, calendar: WorkingCalendar): boolean {
  return !calendar.freeWeekdays.includes(weekdayOf(date)) && !calendar.holidays.includes(date)
}

export function countWorkingDays(from: IsoDate, toExclusive: IsoDate, calendar: WorkingCalendar): number {
  const span = daysBetween(from, toExclusive)
  let count = 0
  for (let offset = 0; offset < span; offset += 1) {
    if (isWorkingDay(addDays(from, offset), calendar)) count += 1
  }
  return count
}

export function addWorkingDays(start: IsoDate, duration: number, calendar: WorkingCalendar): IsoDate {
  if (!(duration > 0)) throw new RangeError(`Expected a positive duration, received ${duration}`)
  let remaining = Math.ceil(duration) - 1
  if (remaining > 0 && new Set(calendar.freeWeekdays).size === 7) {
    throw new RangeError('A calendar with every weekday free has no working day to count')
  }
  let last = start
  while (remaining > 0) {
    last = addDays(last, 1)
    if (isWorkingDay(last, calendar)) remaining -= 1
  }
  return addDays(last, 1)
}
