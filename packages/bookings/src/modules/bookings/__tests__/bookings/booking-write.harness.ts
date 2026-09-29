import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { Conflict } from '../../../../lib/pure-engine'
import { dayStartIn } from '../../../../lib/time/day-ranges'
import { Booking, BookingParticipant, BookingSubject, BookingTarget } from '../../data/entities'
import type { EffectiveBookingsSettings } from '../../services/settings/effective-settings'

export const TENANT = '6f1c2b0e-1c7a-4a52-9d3e-5b8f0d1a2c3d'
export const ORG = '0b9e8d7c-6a5b-4c3d-8e2f-1a0b9c8d7e6f'
export const SCOPE = { tenantId: TENANT, organizationId: ORG }
export const TARGET_ID = '22222222-2222-4222-8222-222222222222'
export const OTHER_TARGET_ID = '22222222-2222-4222-8222-999999999999'
export const SUBJECT_ID = '33333333-3333-4333-8333-333333333333'
export const OTHER_SUBJECT_ID = '33333333-3333-4333-8333-999999999999'
export const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'
export const BOOKING_ID = '55555555-5555-4555-8555-555555555555'

export const WARSAW_MIDNIGHT = (date: string) => dayStartIn(date, 'Europe/Warsaw')

export const overlapWith = (subjectId = SUBJECT_ID): Conflict => ({
  kind: 'overlap',
  subjectId,
  bookingId: BOOKING_ID,
  withBookingId: 'other',
  withTargetName: 'Site B',
  from: '2026-10-06',
  to: '2026-10-07',
})

export function effectiveSettings(overrides: Partial<EffectiveBookingsSettings> = {}): EffectiveBookingsSettings {
  return {
    calendar: { freeWeekdays: [6, 0], holidays: [] },
    warningThresholdWorkingDays: 5,
    conflictPolicy: 'advisory',
    conflictPolicyExceptions: [],
    timeZone: 'Europe/Warsaw',
    ...overrides,
  }
}

export function targetOf(overrides: Partial<BookingTarget> = {}): BookingTarget {
  return Object.assign(new BookingTarget(), {
    id: TARGET_ID,
    ...SCOPE,
    name: 'Site A',
    timeZone: 'Europe/Warsaw',
    color: '#123456',
    deletedAt: null,
    ...overrides,
  })
}

export function subjectOf(overrides: Partial<BookingSubject> = {}): BookingSubject {
  return Object.assign(new BookingSubject(), {
    id: SUBJECT_ID,
    ...SCOPE,
    name: 'Excavator',
    isActive: true,
    category: null,
    deletedAt: null,
    ...overrides,
  })
}

export function bookingOf(overrides: Partial<Booking> = {}): Booking {
  return Object.assign(new Booking(), {
    id: BOOKING_ID,
    ...SCOPE,
    target: targetOf(),
    startAt: WARSAW_MIDNIGHT('2026-10-05'),
    endAt: WARSAW_MIDNIGHT('2026-10-08'),
    status: 'planned',
    durationValue: '3',
    durationUnit: 'working_days',
    expectedStartOn: '2026-10-05',
    lastWarnedWorkingDays: 2,
    note: null,
    deletedAt: null,
    ...overrides,
  })
}

export function participantOf(booking: Booking, subject: BookingSubject): BookingParticipant {
  return Object.assign(new BookingParticipant(), { ...SCOPE, booking, subject, role: 'performer', deletedAt: null })
}

export type Store = {
  booking: Booking | null
  participants: BookingParticipant[]
  subjects: BookingSubject[]
  targets: BookingTarget[]
  persisted: unknown[]
  flushed: boolean
  rolledBack: boolean
}

export function storeWith(overrides: Partial<Store> = {}): Store {
  const booking = overrides.booking === undefined ? bookingOf() : overrides.booking
  const subjects = overrides.subjects ?? [subjectOf()]
  return {
    booking,
    participants: overrides.participants ?? (booking ? subjects.map((subject) => participantOf(booking, subject)) : []),
    subjects,
    targets: overrides.targets ?? [booking?.target ?? targetOf()],
    persisted: overrides.persisted ?? [],
    flushed: false,
    rolledBack: false,
  }
}

type Where = Record<string, unknown> & { id?: string | { $in?: string[] } }

function idsOf(where: Where): string[] | null {
  if (typeof where.id === 'string') return [where.id]
  if (where.id && typeof where.id === 'object' && Array.isArray(where.id.$in)) return where.id.$in
  return null
}

export function ctxFor(store: Store): CommandRuntimeContext {
  const em = {
    fork: () => em,
    isInTransaction: () => true,
    execute: jest.fn(async () => undefined),
    findOne: jest.fn(async (entity: unknown, where: Where) => {
      if (entity === Booking) return store.booking && idsOf(where)?.includes(store.booking.id) ? store.booking : null
      if (entity === BookingTarget) return store.targets.find((target) => idsOf(where)?.includes(target.id) && !target.deletedAt) ?? null
      return null
    }),
    find: jest.fn(async (entity: unknown, where: Where) => {
      if (entity === BookingSubject) return store.subjects.filter((subject) => idsOf(where)?.includes(subject.id))
      if (entity === BookingParticipant) return store.participants.filter((participant) => !participant.deletedAt)
      return []
    }),
    create: jest.fn((entity: new () => object, data: object) => Object.assign(new entity(), data)),
    persist: jest.fn((record: unknown) => {
      store.persisted.push(record)
    }),
    flush: jest.fn(async () => {
      store.flushed = true
    }),
    begin: jest.fn(async () => undefined),
    commit: jest.fn(async () => undefined),
    rollback: jest.fn(async () => {
      store.rolledBack = true
    }),
  }
  return {
    container: { resolve: (name: string) => (name === 'em' ? em : undefined) },
    auth: { sub: 'user-1', tenantId: TENANT, orgId: ORG },
    organizationScope: null,
    selectedOrganizationId: ORG,
    organizationIds: [ORG],
  } as unknown as CommandRuntimeContext
}

export async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (err: unknown) => err)
  if (!isCrudHttpError(error)) throw new Error(`expected a CrudHttpError, got ${String(error)}`)
  return error
}

export const logEntryOf = (payload: unknown) => ({ commandPayload: payload }) as never
