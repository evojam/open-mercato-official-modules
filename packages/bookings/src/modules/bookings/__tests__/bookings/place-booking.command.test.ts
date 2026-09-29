import { placeBookingCommand } from '../../commands/bookings/place-booking.command'
import { emitBookingsEvent } from '../../events'
import { findConflicts } from '../../services/bookings/conflict-check.service'
import { lockSubjects, lockTarget } from '../../services/bookings/subject-lock'
import { resolveEffectiveBookingsSettings } from '../../services/settings/effective-settings'
import {
  BOOKING_ID,
  SCOPE,
  SUBJECT_ID,
  TARGET_ID,
  WARSAW_MIDNIGHT,
  bookingOf,
  ctxFor,
  effectiveSettings,
  logEntryOf,
  overlapWith,
  rejection,
  storeWith,
  subjectOf,
} from './booking-write.harness'
import { BookingSubjectCategory } from '../../data/entities'

jest.mock('@open-mercato/shared/lib/i18n/server', () => ({
  resolveTranslations: async () => ({ translate: (_key: string, fallback?: string) => fallback ?? _key }),
}))
jest.mock('../../events', () => ({ emitBookingsEvent: jest.fn(async () => undefined) }))
jest.mock('../../services/bookings/conflict-check.service', () => ({ findConflicts: jest.fn(async () => []) }))
jest.mock('../../services/bookings/subject-lock', () => ({
  lockSubjects: jest.fn(async () => undefined),
  lockTarget: jest.fn(async () => undefined),
}))
jest.mock('../../services/settings/effective-settings', () => ({ resolveEffectiveBookingsSettings: jest.fn() }))

const unplaced = () => bookingOf({ startAt: null, endAt: null, lastWarnedWorkingDays: 4 })

const input = (overrides: Record<string, unknown> = {}) => ({ ...SCOPE, id: BOOKING_ID, startOn: '2026-10-09', ...overrides }) as never

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(resolveEffectiveBookingsSettings).mockResolvedValue(effectiveSettings())
  jest.mocked(findConflicts).mockResolvedValue([])
})

describe('bookings.bookings.place', () => {
  it('gives an unplaced booking its window over working days and clears the warning counter', async () => {
    const store = storeWith({ booking: unplaced() })

    const result = await placeBookingCommand.execute(input(), ctxFor(store))

    expect(store.booking).toMatchObject({
      startAt: WARSAW_MIDNIGHT('2026-10-09'),
      endAt: WARSAW_MIDNIGHT('2026-10-14'),
      lastWarnedWorkingDays: null,
    })
    expect(lockTarget).toHaveBeenCalledWith(expect.anything(), TARGET_ID)
    expect(lockSubjects).toHaveBeenCalledWith(expect.anything(), [SUBJECT_ID])
    expect(findConflicts).toHaveBeenCalledWith(expect.anything(), SCOPE, expect.objectContaining({
      bookingId: BOOKING_ID,
      status: 'planned',
      days: { from: '2026-10-09', to: '2026-10-14' },
    }))
    expect(result).toEqual({ id: BOOKING_ID, conflicts: [], warnings: [] })
    expect(emitBookingsEvent).toHaveBeenCalledWith('bookings.booking.placed', expect.objectContaining({ id: BOOKING_ID, ...SCOPE }), { persistent: true })
  })

  it('flags a start on a day off without blocking it', async () => {
    const result = await placeBookingCommand.execute(input({ startOn: '2026-10-10' }), ctxFor(storeWith({ booking: unplaced() })))

    expect(result.warnings).toEqual(['start_on_free_day'])
  })

  it('returns the clash under advisory and refuses it with 409 under reject', async () => {
    jest.mocked(findConflicts).mockResolvedValue([overlapWith()])
    const advisory = await placeBookingCommand.execute(input(), ctxFor(storeWith({ booking: unplaced() })))
    expect(advisory.conflicts).toEqual([overlapWith()])

    jest.mocked(resolveEffectiveBookingsSettings).mockResolvedValue(effectiveSettings({ conflictPolicy: 'reject' }))
    jest.mocked(emitBookingsEvent).mockClear()
    const store = storeWith({ booking: unplaced() })
    const error = await rejection(placeBookingCommand.execute(input(), ctxFor(store)))

    expect(error.status).toBe(409)
    expect(error.body).toMatchObject({ code: 'booking_conflict' })
    expect(store.booking?.startAt).toBeNull()
    expect(store.rolledBack).toBe(true)
    expect(emitBookingsEvent).not.toHaveBeenCalled()
  })

  it('applies a category exception when resolving the policy', async () => {
    jest.mocked(findConflicts).mockResolvedValue([overlapWith()])
    jest.mocked(resolveEffectiveBookingsSettings).mockResolvedValue(
      effectiveSettings({ conflictPolicyExceptions: [{ categoryId: '44444444-4444-4444-8444-444444444444', mode: 'reject' }] })
    )
    const category = Object.assign(new BookingSubjectCategory(), { id: '44444444-4444-4444-8444-444444444444' })
    const store = storeWith({ booking: unplaced(), subjects: [subjectOf({ category })] })

    const error = await rejection(placeBookingCommand.execute(input(), ctxFor(store)))

    expect(error.status).toBe(409)
  })

  it('refuses a closed booking and a booking that already has a start', async () => {
    const closed = await rejection(
      placeBookingCommand.execute(input(), ctxFor(storeWith({ booking: bookingOf({ startAt: null, endAt: null, status: 'cancelled' }) })))
    )
    const placed = await rejection(placeBookingCommand.execute(input(), ctxFor(storeWith())))

    expect(closed.status).toBe(422)
    expect(closed.body).toMatchObject({ code: 'booking_closed', details: { status: 'cancelled' } })
    expect(placed.status).toBe(422)
    expect(placed.body).toMatchObject({ code: 'booking_placed' })
  })

  it('answers 404 for an unknown booking and 409 without settings', async () => {
    const missing = await rejection(placeBookingCommand.execute(input(), ctxFor(storeWith({ booking: null }))))
    jest.mocked(resolveEffectiveBookingsSettings).mockResolvedValue(effectiveSettings({ timeZone: null }))
    const noSettings = await rejection(placeBookingCommand.execute(input(), ctxFor(storeWith({ booking: unplaced() }))))

    expect(missing.status).toBe(404)
    expect(noSettings.body).toMatchObject({ code: 'settings_required' })
  })

  it('undoes a placement by taking the window away again without a conflict check', async () => {
    const store = storeWith()
    const before = {
      id: BOOKING_ID,
      ...SCOPE,
      targetId: TARGET_ID,
      subjectIds: [SUBJECT_ID],
      status: 'planned',
      startAt: null,
      endAt: null,
      durationValue: '3',
      durationUnit: 'working_days',
      expectedStartOn: '2026-10-05',
      lastWarnedWorkingDays: 4,
      note: null,
    }

    await placeBookingCommand.undo!({ input: {} as never, ctx: ctxFor(store), logEntry: logEntryOf({ undo: { before } }) })

    expect(store.booking).toMatchObject({ startAt: null, endAt: null, lastWarnedWorkingDays: 4 })
    expect(findConflicts).not.toHaveBeenCalled()
    expect(emitBookingsEvent).toHaveBeenCalledWith('bookings.booking.updated', expect.objectContaining({ id: BOOKING_ID }), { persistent: true })
  })
})
