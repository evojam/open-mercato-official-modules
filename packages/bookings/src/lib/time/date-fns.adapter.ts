import { TZDate, tzOffset } from '@date-fns/tz'
import { addDays as addCalendarDays, differenceInCalendarDays, format, getDay } from 'date-fns'

import type { IsoDate, WallTime, Weekday } from './types'

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const WALL_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

// Not `Intl.supportedValuesOf('timeZone')`: it omits `UTC` and the `Etc/*` aliases the runtime still accepts.
export function isValidTimeZone(zone: string): boolean {
  if (!zone) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

function assertTimeZone(zone: string): void {
  if (!isValidTimeZone(zone)) throw new TypeError(`Unknown time zone "${zone}"`)
}

function calendarDay(date: IsoDate): TZDate {
  const parts = ISO_DATE.exec(date)
  if (!parts) throw new TypeError(`Expected an ISO date (YYYY-MM-DD), received "${date}"`)
  const day = new TZDate(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 'UTC')
  if (format(day, 'yyyy-MM-dd') !== date) throw new TypeError(`"${date}" is not a calendar date`)
  return day
}

export function isIsoDate(value: string): boolean {
  try {
    calendarDay(value)
    return true
  } catch {
    return false
  }
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return format(addCalendarDays(calendarDay(date), days), 'yyyy-MM-dd')
}

export function weekdayOf(date: IsoDate): Weekday {
  return getDay(calendarDay(date)) as Weekday
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return differenceInCalendarDays(calendarDay(to), calendarDay(from))
}

export function toZonedIsoDate(instant: Date, zone: string): IsoDate {
  assertTimeZone(zone)
  return format(new TZDate(instant, zone), 'yyyy-MM-dd')
}

function offsetMsAt(instantMs: number, zone: string): number {
  return Math.round(tzOffset(zone, new Date(instantMs))) * MINUTE_MS
}

// Resolved by hand, not by TZDate: its constructor disambiguates a clock change through the host's zone.
export function zonedWallTimeToInstant(date: IsoDate, wallTime: WallTime, zone: string): Date {
  const time = WALL_TIME.exec(wallTime)
  if (!time) throw new TypeError(`Expected a wall time (HH:mm), received "${wallTime}"`)
  assertTimeZone(zone)
  const wallAsUtc = calendarDay(date).getTime() + (Number(time[1]) * 60 + Number(time[2])) * MINUTE_MS
  const candidates = [
    wallAsUtc - offsetMsAt(wallAsUtc - DAY_MS, zone),
    wallAsUtc - offsetMsAt(wallAsUtc + DAY_MS, zone),
  ]
  const real = candidates.filter((candidate) => wallAsUtc - offsetMsAt(candidate, zone) === candidate)
  return new Date(real.length > 0 ? Math.min(...real) : Math.max(...candidates))
}

export function zonedDayStart(date: IsoDate, zone: string): Date {
  return zonedWallTimeToInstant(date, '00:00', zone)
}
