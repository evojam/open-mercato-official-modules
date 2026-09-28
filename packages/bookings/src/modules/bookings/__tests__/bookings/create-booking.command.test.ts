import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { Conflict } from '../../../../lib/pure-engine'
import { createBookingCommand } from '../../commands/bookings/create-booking.command'
import { Booking, BookingParticipant, BookingSubject, BookingSubjectCategory, BookingTarget } from '../../data/entities'
import { emitBookingsEvent } from '../../events'
import { findConflicts } from '../../services/bookings/conflict-check.service'
import { lockSubjects } from '../../services/bookings/subject-lock'
import { resolveEffectiveBookingsSettings } from '../../services/settings/effective-settings'
import type { EffectiveBookingsSettings } from '../../services/settings/effective-settings'

jest.mock('@open-mercato/shared/lib/i18n/server', () => ({
  resolveTranslations: async () => ({ translate: (_key: string, fallback?: string) => fallback ?? _key }),
}))
jest.mock('../../events', () => ({ emitBookingsEvent: jest.fn(async () => undefined) }))
jest.mock('../../services/bookings/conflict-check.service', () => ({ findConflicts: jest.fn(async () => []) }))
jest.mock('../../services/bookings/subject-lock', () => ({ lockSubjects: jest.fn(async () => undefined) }))
jest.mock('../../services/settings/effective-settings', () => ({ resolveEffectiveBookingsSettings: jest.fn() }))

const TENANT = '6f1c2b0e-1c7a-4a52-9d3e-5b8f0d1a2c3d'
const ORG = '0b9e8d7c-6a5b-4c3d-8e2f-1a0b9c8d7e6f'
const SCOPE = { tenantId: TENANT, organizationId: ORG }
const TARGET_ID = '22222222-2222-4222-8222-222222222222'
const SUBJECT_ID = '33333333-3333-4333-8333-333333333333'
const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'

const overlap: Conflict = {
  kind: 'overlap',
  subjectId: SUBJECT_ID,
  bookingId: 'new',
  withBookingId: 'other',
  withTargetName: 'Site B',
  from: '2026-10-06',
  to: '2026-10-07',
}

type Store = { persisted: unknown[]; target: BookingTarget | null; subjects: BookingSubject[]; flushed: boolean; rolledBack: boolean }

function effectiveSettings(overrides: Partial<EffectiveBookingsSettings> = {}): EffectiveBookingsSettings {
  return {
    calendar: { freeWeekdays: [6, 0], holidays: [] },
    warningThresholdWorkingDays: 5,
    conflictPolicy: 'advisory',
    conflictPolicyExceptions: [],
    timeZone: 'Europe/Warsaw',
    ...overrides,
  }
}

function subject(extra: Partial<BookingSubject> = {}): BookingSubject {
  return Object.assign(new BookingSubject(), { id: SUBJECT_ID, ...SCOPE, name: 'Excavator', isActive: true, category: null, ...extra })
}

function storeWith(overrides: Partial<Store> = {}): Store {
  return {
    persisted: [],
    target: Object.assign(new BookingTarget(), { id: TARGET_ID, ...SCOPE, name: 'Site A', timeZone: 'Europe/Warsaw' }),
    subjects: [subject()],
    flushed: false,
    rolledBack: false,
    ...overrides,
  }
}

function ctxFor(store: Store): CommandRuntimeContext {
  const em = {
    fork: () => em,
    findOne: jest.fn(async (entity: unknown) => (entity === BookingTarget ? store.target : null)),
    find: jest.fn(async (entity: unknown) => (entity === BookingSubject ? store.subjects : [])),
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

function input(overrides: Record<string, unknown> = {}) {
  return {
    ...SCOPE,
    targetId: TARGET_ID,
    subjectIds: [SUBJECT_ID],
    durationValue: 3,
    expectedStartOn: '2026-10-05',
    startOn: '2026-10-05',
    ...overrides,
  } as never
}

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (err: unknown) => err)
  if (!isCrudHttpError(error)) throw new Error(`expected a CrudHttpError, got ${String(error)}`)
  return error
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(resolveEffectiveBookingsSettings).mockResolvedValue(effectiveSettings())
  jest.mocked(findConflicts).mockResolvedValue([])
})

describe('bookings.bookings.create', () => {
  it('places the booking over working days at the target midnights and saves one participant', async () => {
    const store = storeWith()

    const result = await createBookingCommand.execute(input({ startOn: '2026-10-09' }), ctxFor(store))

    const booking = store.persisted.find((record) => record instanceof Booking) as Booking
    expect(booking.startAt).toEqual(new Date('2026-10-08T22:00:00.000Z'))
    expect(booking.endAt).toEqual(new Date('2026-10-13T22:00:00.000Z'))
    expect(booking.durationValue).toBe('3')
    expect(store.persisted.filter((record) => record instanceof BookingParticipant)).toHaveLength(1)
    expect(lockSubjects).toHaveBeenCalledWith(expect.anything(), [SUBJECT_ID])
    expect(result).toEqual({ id: booking.id, conflicts: [], warnings: [] })
    expect(emitBookingsEvent).toHaveBeenCalledWith(
      'bookings.booking.created',
      expect.objectContaining({ id: booking.id, ...SCOPE }),
      { persistent: true }
    )
  })

  it('saves a clash under advisory and returns it', async () => {
    jest.mocked(findConflicts).mockResolvedValue([overlap])
    const store = storeWith()

    const result = await createBookingCommand.execute(input(), ctxFor(store))

    expect(store.flushed).toBe(true)
    expect(result.conflicts).toEqual([overlap])
  })

  it('refuses a clash with 409 when the category of the subject rejects conflicts', async () => {
    jest.mocked(resolveEffectiveBookingsSettings).mockResolvedValue(
      effectiveSettings({ conflictPolicyExceptions: [{ categoryId: CATEGORY_ID, mode: 'reject' }] })
    )
    jest.mocked(findConflicts).mockResolvedValue([overlap])
    const category = Object.assign(new BookingSubjectCategory(), { id: CATEGORY_ID })
    const store = storeWith({ subjects: [subject({ category })] })

    const error = await rejection(createBookingCommand.execute(input(), ctxFor(store)))

    expect(error.status).toBe(409)
    expect(error.body).toMatchObject({ code: 'booking_conflict', details: { conflicts: [overlap] } })
    expect(store.rolledBack).toBe(true)
    expect(store.persisted).toEqual([])
    expect(emitBookingsEvent).not.toHaveBeenCalled()
  })

  it('warns about a start on a day off and never blocks it', async () => {
    const result = await createBookingCommand.execute(input({ startOn: '2026-10-10' }), ctxFor(storeWith()))

    expect(result.warnings).toEqual(['start_on_free_day'])
  })

  it('keeps a booking without a start off the timeline and skips the lock', async () => {
    const store = storeWith()

    await createBookingCommand.execute(input({ startOn: null }), ctxFor(store))

    const booking = store.persisted.find((record) => record instanceof Booking) as Booking
    expect(booking.startAt).toBeNull()
    expect(booking.endAt).toBeNull()
    expect(lockSubjects).not.toHaveBeenCalled()
    expect(findConflicts).not.toHaveBeenCalled()
  })

  it('refuses an inactive subject, a missing target and a missing settings row', async () => {
    const inactive = await rejection(
      createBookingCommand.execute(input(), ctxFor(storeWith({ subjects: [subject({ isActive: false })] })))
    )
    const missingTarget = await rejection(createBookingCommand.execute(input(), ctxFor(storeWith({ target: null }))))
    jest.mocked(resolveEffectiveBookingsSettings).mockResolvedValue(effectiveSettings({ timeZone: null }))
    const noSettings = await rejection(createBookingCommand.execute(input(), ctxFor(storeWith())))

    expect(inactive.body).toMatchObject({ code: 'subject_inactive' })
    expect(missingTarget.status).toBe(404)
    expect(noSettings.body).toMatchObject({ code: 'settings_required' })
  })

  it('rejects a duration that is not a whole or half day', async () => {
    const error = await rejection(createBookingCommand.execute(input({ durationValue: 1.25 }), ctxFor(storeWith())))

    expect(error.status).toBe(400)
  })
})
