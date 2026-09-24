import { addDays, toZonedIsoDate } from './date-fns.adapter'
import type { DayRange } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

type Window = {
  from: Date
  to: Date
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

export function bookingDays(window: Window, targetZone: string): DayRange | null {
  return isUsable(window) ? daysTouched(window, targetZone) : null
}

// A whole-day window is read at its middle: planner's write paths anchor "midnight" to UTC, the server or the browser.
export function unavailabilityDays(window: Window, subjectZone: string): DayRange | null {
  if (!isUsable(window)) return null
  const length = window.to.getTime() - window.from.getTime()
  if (length % DAY_MS !== 0) return daysTouched(window, subjectZone)
  const first = toZonedIsoDate(new Date(window.from.getTime() + DAY_MS / 2), subjectZone)
  return { from: first, to: addDays(first, length / DAY_MS) }
}
