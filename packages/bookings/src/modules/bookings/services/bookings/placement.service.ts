import { addWorkingDays, isWorkingDay } from '../../../../lib/pure-engine'
import type { WorkingCalendar } from '../../../../lib/pure-engine'
import { dayStartIn } from '../../../../lib/time/day-ranges'
import type { DayRange, IsoDate } from '../../../../lib/time/types'

export type BookingPlacement = {
  days: DayRange
  startAt: Date
  endAt: Date
  startsOnFreeDay: boolean
}

export function placeBooking(input: {
  startOn: IsoDate
  durationWorkingDays: number
  calendar: WorkingCalendar
  targetZone: string
}): BookingPlacement {
  const to = addWorkingDays(input.startOn, input.durationWorkingDays, input.calendar)
  return {
    days: { from: input.startOn, to },
    startAt: dayStartIn(input.startOn, input.targetZone),
    endAt: dayStartIn(to, input.targetZone),
    startsOnFreeDay: !isWorkingDay(input.startOn, input.calendar),
  }
}
