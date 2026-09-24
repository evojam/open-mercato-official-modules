import { addDays, daysBetween, weekdayOf } from '../time/date-fns.adapter'
import type { IsoDate, Weekday } from '../time/types'

export type WorkingCalendar = {
  readonly freeWeekdays: readonly Weekday[]
  readonly holidays: readonly IsoDate[]
}

function workingDayTest(calendar: WorkingCalendar): (date: IsoDate) => boolean {
  const freeWeekdays = new Set<Weekday>(calendar.freeWeekdays)
  const holidays = new Set<IsoDate>(calendar.holidays)
  return (date) => !freeWeekdays.has(weekdayOf(date)) && !holidays.has(date)
}

export function isWorkingDay(date: IsoDate, calendar: WorkingCalendar): boolean {
  return workingDayTest(calendar)(date)
}

export function countWorkingDays(
  from: IsoDate,
  toExclusive: IsoDate,
  calendar: WorkingCalendar,
  stopAbove: number = Number.POSITIVE_INFINITY
): number {
  const isWorking = workingDayTest(calendar)
  const span = daysBetween(from, toExclusive)
  let count = 0
  for (let offset = 0; offset < span && count <= stopAbove; offset += 1) {
    if (isWorking(addDays(from, offset))) count += 1
  }
  return count
}

export function addWorkingDays(start: IsoDate, duration: number, calendar: WorkingCalendar): IsoDate {
  if (!(duration > 0)) throw new RangeError(`Expected a positive duration, received ${duration}`)
  let remaining = Math.ceil(duration) - 1
  if (remaining > 0 && new Set(calendar.freeWeekdays).size === 7) {
    throw new RangeError('A calendar with every weekday free has no working day to count')
  }
  const isWorking = workingDayTest(calendar)
  let last = start
  while (remaining > 0) {
    last = addDays(last, 1)
    if (isWorking(last)) remaining -= 1
  }
  return addDays(last, 1)
}
