import { TZDate, tzOffset } from '@date-fns/tz'
import { format } from 'date-fns'

import type { IsoDate, WallTime, Weekday } from './types'

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const WALL_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

const knownZones = new Set<string>()

// Not `Intl.supportedValuesOf('timeZone')`: it omits `UTC` and the `Etc/*` aliases the runtime still accepts.
export function isValidTimeZone(zone: string): boolean {
  if (!zone) return false
  if (knownZones.has(zone)) return true
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
    knownZones.add(zone)
    return true
  } catch {
    return false
  }
}

function assertTimeZone(zone: string): void {
  if (!isValidTimeZone(zone)) throw new TypeError(`Unknown time zone "${zone}"`)
}

function isoOf(utcMidnightMs: number): IsoDate {
  return new Date(utcMidnightMs).toISOString().slice(0, 10)
}

function parseIsoDate(date: string): number | null {
  const parts = ISO_DATE.exec(date)
  if (!parts) return null
  const utcMidnightMs = Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
  return isoOf(utcMidnightMs) === date ? utcMidnightMs : null
}

function utcMidnightOf(date: IsoDate): number {
  const utcMidnightMs = parseIsoDate(date)
  if (utcMidnightMs === null) throw new TypeError(`Expected a calendar date (YYYY-MM-DD), received "${date}"`)
  return utcMidnightMs
}

export function isIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return isoOf(utcMidnightOf(date) + days * DAY_MS)
}

export function weekdayOf(date: IsoDate): Weekday {
  return new Date(utcMidnightOf(date)).getUTCDay() as Weekday
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((utcMidnightOf(to) - utcMidnightOf(from)) / DAY_MS)
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
  const wallAsUtc = utcMidnightOf(date) + (Number(time[1]) * 60 + Number(time[2])) * MINUTE_MS
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
