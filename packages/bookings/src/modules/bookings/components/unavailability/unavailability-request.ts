import type { Conflict } from '../../../../lib/pure-engine'
import { rangeThrough } from '../../../../lib/timeline/layout/range'
import { dayStartIn } from '../../../../lib/time/day-ranges'
import type { DayRange, IsoDate } from '../../../../lib/time/types'
import { BOOKINGS_API_PATHS, PLANNER_API_PATHS } from '../../lib/api-paths'

export type PlannerSubjectType = 'member' | 'resource'

export type UnavailabilityReason = { entryId: string; value: string }

export type UnavailabilityRuleInput = {
  subjectType: PlannerSubjectType
  subjectId: string
  timeZone: string
  from: IsoDate
  toInclusive: IsoDate
  reason?: UnavailabilityReason | null
  note?: string | null
}

export type PlannerAvailabilityRulePayload = {
  subjectType: PlannerSubjectType
  subjectId: string
  timezone: string
  rrule: string
  kind: 'unavailability'
  note?: string
  unavailabilityReasonEntryId?: string
  unavailabilityReasonValue?: string
}

export type Fetcher = <T>(path: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; result: T | null }>

export type UnavailabilitySaveResult =
  | { ok: true; id: string | null; conflicts: Conflict[] }
  | { ok: false; status: number; error: string | null }

export function plannerSubjectTypeOf(providerKey: string): PlannerSubjectType | null {
  if (providerKey === 'staff') return 'member'
  if (providerKey === 'resources') return 'resource'
  return null
}

export function unavailabilityDays(from: IsoDate, toInclusive: IsoDate): DayRange {
  return rangeThrough(from, toInclusive)
}

function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]|\.\d{3}/g, '')
}

function isoDuration(start: Date, end: Date): string {
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `PT${hours}H` : `PT${hours}H${rest}M`
}

export function buildUnavailabilityRule(input: UnavailabilityRuleInput): PlannerAvailabilityRulePayload {
  const days = unavailabilityDays(input.from, input.toInclusive)
  const start = dayStartIn(days.from, input.timeZone)
  const end = dayStartIn(days.to, input.timeZone)
  const note = input.note?.trim()
  return {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    timezone: input.timeZone,
    rrule: `DTSTART:${utcStamp(start)}\nDURATION:${isoDuration(start, end)}\nRRULE:FREQ=DAILY;COUNT=1`,
    kind: 'unavailability',
    ...(note ? { note } : {}),
    ...(input.reason ? { unavailabilityReasonEntryId: input.reason.entryId, unavailabilityReasonValue: input.reason.value } : {}),
  }
}

export async function saveUnavailability(
  fetcher: Fetcher,
  rule: PlannerAvailabilityRulePayload,
  bookingSubjectId: string,
  days: DayRange
): Promise<UnavailabilitySaveResult> {
  const write = await fetcher<{ id?: string; error?: string }>(PLANNER_API_PATHS.availability, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(rule),
  })
  if (!write.ok) return { ok: false, status: write.status, error: write.result?.error ?? null }
  const params = new URLSearchParams({ subjectIds: bookingSubjectId, from: days.from, to: days.to })
  const read = await fetcher<{ conflicts?: Conflict[] }>(`${BOOKINGS_API_PATHS.conflicts}?${params.toString()}`)
  return { ok: true, id: write.result?.id ?? null, conflicts: read.ok ? (read.result?.conflicts ?? []) : [] }
}
