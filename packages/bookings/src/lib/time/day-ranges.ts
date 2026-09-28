import {
  addDays,
  isIsoDate,
  isValidTimeZone,
  normalizeTimeZone,
  supportedTimeZones,
  toZonedIsoDate,
  zonedDayStart,
  zonedWallClock,
} from './date-fns.adapter'
import type { DayRange, IsoDate } from './types'

export { isIsoDate, isValidTimeZone, normalizeTimeZone, supportedTimeZones }

const DAY_MS = 24 * 60 * 60 * 1000
const WIDEST_OFFSET_MS = 14 * 60 * 60 * 1000

type Window = {
  from: Date
  to: Date
}

export type UnavailabilityZones = {
  subject: string
  organization: string
}

export function todayIn(now: Date, zone: string): IsoDate {
  return toZonedIsoDate(now, zone)
}

export function wallClockIn(now: Date, zone: string): string {
  return zonedWallClock(now, zone)
}

export function dayStartIn(date: IsoDate, zone: string): Date {
  return zonedDayStart(date, zone)
}

function isUsable({ from, to }: Window): boolean {
  return Number.isFinite(from.getTime()) && Number.isFinite(to.getTime()) && from < to
}

function daysTouched({ from, to }: Window, zone: string): DayRange {
  return {
    from: toZonedIsoDate(from, zone),
    to: addDays(toZonedIsoDate(new Date(to.getTime() - 1), zone), 1),
  }
}

function isMidnightIn(instant: Date, zone: string): boolean {
  return zonedDayStart(toZonedIsoDate(instant, zone), zone).getTime() === instant.getTime()
}

export function candidateWindow(days: DayRange): Window {
  return {
    from: new Date(zonedDayStart(days.from, 'UTC').getTime() - WIDEST_OFFSET_MS),
    to: new Date(zonedDayStart(days.to, 'UTC').getTime() + WIDEST_OFFSET_MS),
  }
}

export function bookingDays(window: Window, targetZone: string): DayRange | null {
  return isUsable(window) ? daysTouched(window, targetZone) : null
}

// Planner stores a whole day as two instants with no zone; the zone whose midnights they are tells which day was meant.
export function unavailabilityDays(window: Window, zones: UnavailabilityZones): DayRange | null {
  if (!isUsable(window)) return null
  const anchor = [zones.subject, 'UTC', zones.organization].find(
    (zone) => isMidnightIn(window.from, zone) && isMidnightIn(window.to, zone)
  )
  if (anchor) return { from: toZonedIsoDate(window.from, anchor), to: toZonedIsoDate(window.to, anchor) }

  const length = window.to.getTime() - window.from.getTime()
  if (length % DAY_MS !== 0) return daysTouched(window, zones.subject)
  const first = toZonedIsoDate(new Date(window.from.getTime() + DAY_MS / 2), zones.subject)
  return { from: first, to: addDays(first, length / DAY_MS) }
}
