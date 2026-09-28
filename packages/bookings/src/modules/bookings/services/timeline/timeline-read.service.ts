import type { EntityManager } from '@mikro-orm/postgresql'
import type { QueryEngine } from '@open-mercato/shared/lib/query/types'
import { detectConflicts } from '../../../../lib/pure-engine'
import type { BookingStatus, Conflict, Placement, UnavailabilityWindow, WorkingCalendar } from '../../../../lib/pure-engine'
import { defaultTimelineRange } from '../../../../lib/timeline/layout/range'
import { bookingDays, candidateWindow, todayIn, unavailabilityDays, wallClockIn } from '../../../../lib/time/day-ranges'
import type { DayRange, IsoDate } from '../../../../lib/time/types'
import { BookingParticipant, BookingSubject } from '../../data/entities'
import { bookingsErrors } from '../../lib/errors'
import { resolveEffectiveBookingsSettings } from '../settings/effective-settings'
import type { BookingsScope } from '../settings/effective-settings'
import { getSubjectProvider } from '../subjects/providers/registry'

export type TimelineReadQuery = {
  range?: DayRange
  categoryId?: string
  conflictsOnly?: boolean
  hideUnavailable?: boolean
}

export type TimelineCategoryDto = {
  id: string
  name: string
  icon: string | null
  color: string | null
}

export type TimelineRowDto = {
  subjectId: string
  name: string
  category: TimelineCategoryDto | null
  isActive: boolean
  providerKey: string
  cardHref: string | null
  unavailabilityKnown: boolean
}

export type TimelineBarDto = DayRange & {
  bookingId: string
  subjectId: string
  targetId: string
  targetName: string
  targetColor: string | null
  status: BookingStatus
  note: string | null
  conflicts: Conflict[]
}

export type TimelineUnavailabilityDto = DayRange & {
  windowId: string
  subjectId: string
  reason: string | null
}

export type TimelineReadDto = {
  range: DayRange
  today: IsoDate
  wallClock: string
  timeZone: string
  calendar: WorkingCalendar
  rows: TimelineRowDto[]
  bars: TimelineBarDto[]
  unavailability: TimelineUnavailabilityDto[]
}

export type TimelineResponseDto = TimelineReadDto & {
  canCreate: boolean
}

type TimelineReadDeps = {
  em: EntityManager
  queryEngine: QueryEngine
}

type SubjectUnavailability = {
  windows: TimelineUnavailabilityDto[]
  unknownSubjectIds: Set<string>
}

export type TimelineSources = {
  range: DayRange
  today: IsoDate
  wallClock: string
  timeZone: string
  calendar: WorkingCalendar
  subjects: BookingSubject[]
  participants: BookingParticipant[]
  unavailability: SubjectUnavailability
  query: TimelineReadQuery
}

function barsOf(participants: BookingParticipant[]): TimelineBarDto[] {
  return participants.flatMap((participant) => {
    const { booking } = participant
    if (!booking.startAt || !booking.endAt) return []
    const days = bookingDays({ from: booking.startAt, to: booking.endAt }, booking.target.timeZone)
    if (!days) return []
    return [
      {
        ...days,
        bookingId: booking.id,
        subjectId: participant.subject.id,
        targetId: booking.target.id,
        targetName: booking.target.name,
        targetColor: booking.target.color ?? null,
        status: booking.status,
        note: booking.note ?? null,
        conflicts: [],
      },
    ]
  })
}

function withConflicts(bars: TimelineBarDto[], windows: TimelineUnavailabilityDto[]): TimelineBarDto[] {
  const placements: Placement[] = bars.map((bar) => ({
    from: bar.from,
    to: bar.to,
    bookingId: bar.bookingId,
    subjectId: bar.subjectId,
    status: bar.status,
    targetName: bar.targetName,
  }))
  const unavailability: UnavailabilityWindow[] = windows.map((window) => ({
    from: window.from,
    to: window.to,
    windowId: window.windowId,
    subjectId: window.subjectId,
    reasonLabel: window.reason ?? undefined,
  }))
  const byBar = new Map<string, Conflict[]>()
  for (const conflict of detectConflicts({ placements, unavailability })) {
    const key = `${conflict.bookingId}:${conflict.subjectId}`
    const group = byBar.get(key)
    if (group) group.push(conflict)
    else byBar.set(key, [conflict])
  }
  return bars.map((bar) => ({ ...bar, conflicts: byBar.get(`${bar.bookingId}:${bar.subjectId}`) ?? [] }))
}

function overlapsRange(days: DayRange, range: DayRange): boolean {
  return days.from < range.to && days.to > range.from
}

function byCategoryThenName(categoryName: (subject: BookingSubject) => string | null) {
  return (a: BookingSubject, b: BookingSubject): number => {
    const left = categoryName(a)
    const right = categoryName(b)
    if (left !== right) {
      if (left === null) return 1
      if (right === null) return -1
      return left.localeCompare(right)
    }
    return a.name.localeCompare(b.name)
  }
}

export function assembleTimeline(sources: TimelineSources): TimelineReadDto {
  const { range, query, unavailability } = sources
  const allBars = withConflicts(barsOf(sources.participants), unavailability.windows)
  const barSubjectIds = new Set(allBars.filter((bar) => overlapsRange(bar, range)).map((bar) => bar.subjectId))
  const conflictSubjectIds = new Set(
    allBars.filter((bar) => bar.conflicts.length > 0 && overlapsRange(bar, range)).map((bar) => bar.subjectId)
  )
  const unavailableSubjectIds = new Set(
    unavailability.windows.filter((window) => overlapsRange(window, range)).map((window) => window.subjectId)
  )

  const subjects = sources.subjects
    .filter((subject) => subject.isActive || barSubjectIds.has(subject.id))
    .filter((subject) => !query.conflictsOnly || conflictSubjectIds.has(subject.id))
    .filter((subject) => !query.hideUnavailable || !unavailableSubjectIds.has(subject.id))
    .sort(byCategoryThenName((subject) => subject.category?.name ?? null))
  const shown = new Set(subjects.map((subject) => subject.id))

  return {
    range,
    today: sources.today,
    wallClock: sources.wallClock,
    timeZone: sources.timeZone,
    calendar: {
      freeWeekdays: sources.calendar.freeWeekdays,
      holidays: sources.calendar.holidays.filter((date) => date >= range.from && date < range.to),
    },
    rows: subjects.map((subject) => ({
      subjectId: subject.id,
      name: subject.name,
      category: subject.category ? categoryOf(subject.category) : null,
      isActive: subject.isActive,
      providerKey: subject.providerKey,
      cardHref: getSubjectProvider(subject.providerKey)?.cardHref(subject.providerRecordId) ?? null,
      unavailabilityKnown: !unavailability.unknownSubjectIds.has(subject.id),
    })),
    bars: allBars.filter((bar) => shown.has(bar.subjectId) && overlapsRange(bar, range)),
    unavailability: unavailability.windows.filter(
      (window) => shown.has(window.subjectId) && overlapsRange(window, range)
    ),
  }
}

function categoryOf(category: NonNullable<BookingSubject['category']>): TimelineCategoryDto {
  return { id: category.id, name: category.name, icon: category.icon ?? null, color: category.color ?? null }
}

async function readUnavailability(
  deps: TimelineReadDeps,
  scope: BookingsScope,
  subjects: BookingSubject[],
  window: InstantWindow,
  organizationZone: string
): Promise<SubjectUnavailability> {
  const result: SubjectUnavailability = { windows: [], unknownSubjectIds: new Set() }
  const byProvider = new Map<string, BookingSubject[]>()
  for (const subject of subjects) {
    const group = byProvider.get(subject.providerKey)
    if (group) group.push(subject)
    else byProvider.set(subject.providerKey, [subject])
  }

  await Promise.all(
    [...byProvider].map(async ([providerKey, providerSubjects]) => {
      const provider = getSubjectProvider(providerKey)
      const answer = provider
        ? await provider.unavailability(
            { queryEngine: deps.queryEngine, scope },
            providerSubjects.map((subject) => subject.providerRecordId),
            window
          )
        : null
      if (answer === null) {
        for (const subject of providerSubjects) result.unknownSubjectIds.add(subject.id)
        return
      }
      const byRecord = new Map(providerSubjects.map((subject) => [subject.providerRecordId, subject]))
      for (const entry of answer) {
        const subject = byRecord.get(entry.recordId)
        if (!subject) continue
        const days = unavailabilityDays(
          { from: entry.from, to: entry.to },
          { subject: subject.timeZone, organization: organizationZone }
        )
        if (!days) continue
        result.windows.push({
          ...days,
          windowId: `${subject.id}:${entry.from.toISOString()}:${entry.to.toISOString()}`,
          subjectId: subject.id,
          reason: entry.reason,
        })
      }
    })
  )
  return result
}

type InstantWindow = { from: Date; to: Date }

async function participantsWithin(
  em: EntityManager,
  scope: BookingsScope,
  subjectIds: string[],
  window: InstantWindow
): Promise<BookingParticipant[]> {
  return em.find(
    BookingParticipant,
    {
      ...scope,
      deletedAt: null,
      subject: { $in: subjectIds },
      booking: { deletedAt: null, status: { $ne: 'cancelled' }, startAt: { $lt: window.to }, endAt: { $gt: window.from } },
    },
    { populate: ['booking', 'booking.target', 'subject'] }
  )
}

function hullOf(participants: BookingParticipant[], window: InstantWindow): InstantWindow {
  let from = window.from
  let to = window.to
  for (const { booking } of participants) {
    if (booking.startAt && booking.startAt < from) from = booking.startAt
    if (booking.endAt && booking.endAt > to) to = booking.endAt
  }
  return from === window.from && to === window.to ? window : { from, to }
}

export async function readTimeline(
  deps: TimelineReadDeps,
  scope: BookingsScope,
  query: TimelineReadQuery,
  now: Date
): Promise<TimelineReadDto> {
  const settings = await resolveEffectiveBookingsSettings(deps.em, scope)
  if (!settings.timeZone) throw bookingsErrors.settingsRequired()
  const timeZone = settings.timeZone
  const today = todayIn(now, timeZone)
  const range = query.range ?? defaultTimelineRange(today)
  const window = candidateWindow(range)

  const subjects = await deps.em.find(
    BookingSubject,
    { ...scope, deletedAt: null, ...(query.categoryId ? { category: query.categoryId } : {}) },
    { populate: ['category'] }
  )
  const subjectIds = subjects.map((subject) => subject.id)
  const inRange = subjects.length ? await participantsWithin(deps.em, scope, subjectIds, window) : []
  // A bar that sticks out of the range can clash with a booking that lies wholly outside it.
  const hull = hullOf(inRange, window)
  const participants = hull === window ? inRange : await participantsWithin(deps.em, scope, subjectIds, hull)
  const unavailability = await readUnavailability(deps, scope, subjects, hull, timeZone)

  return assembleTimeline({
    range,
    today,
    wallClock: wallClockIn(now, timeZone),
    timeZone,
    calendar: settings.calendar,
    subjects,
    participants,
    unavailability,
    query,
  })
}
