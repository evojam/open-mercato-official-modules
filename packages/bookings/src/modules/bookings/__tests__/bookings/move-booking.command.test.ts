import { moveBookingCommand } from '../../commands/bookings/move-booking.command'
import { emitBookingsEvent } from '../../events'
import { findConflicts } from '../../services/bookings/conflict-check.service'
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
} from './booking-write.harness'

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

const input = (overrides: Record<string, unknown> = {}) => ({ ...SCOPE, id: BOOKING_ID, startOn: '2026-10-12', ...overrides }) as never

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(resolveEffectiveBookingsSettings).mockResolvedValue(effectiveSettings())
  jest.mocked(findConflicts).mockResolvedValue([])
})

describe('bookings.bookings.move', () => {
  it('moves the start and keeps the working days', async () => {
    const store = storeWith()

    const result = await moveBookingCommand.execute(input(), ctxFor(store))

    expect(store.booking).toMatchObject({
      startAt: WARSAW_MIDNIGHT('2026-10-12'),
      endAt: WARSAW_MIDNIGHT('2026-10-15'),
      durationValue: '3',
      lastWarnedWorkingDays: 2,
    })
    expect(result).toEqual({ id: BOOKING_ID, conflicts: [], warnings: [] })
    expect(emitBookingsEvent).toHaveBeenCalledWith('bookings.booking.moved', expect.objectContaining({ id: BOOKING_ID }), { persistent: true })
  })

  it('rounds two and a half days up to three working days and skips the weekend', async () => {
    const store = storeWith({ booking: bookingOf({ durationValue: '2.5' }) })

    await moveBookingCommand.execute(input({ startOn: '2026-10-08' }), ctxFor(store))

    expect(store.booking?.endAt).toEqual(WARSAW_MIDNIGHT('2026-10-13'))
  })

  it('refuses a booking without a start and a closed one', async () => {
    const unplaced = await rejection(
      moveBookingCommand.execute(input(), ctxFor(storeWith({ booking: bookingOf({ startAt: null, endAt: null }) })))
    )
    const closed = await rejection(moveBookingCommand.execute(input(), ctxFor(storeWith({ booking: bookingOf({ status: 'completed' }) }))))

    expect(unplaced.body).toMatchObject({ code: 'booking_not_placed' })
    expect(closed.body).toMatchObject({ code: 'booking_closed' })
  })

  it('leaves the booking where it was when reject refuses the new slot', async () => {
    jest.mocked(resolveEffectiveBookingsSettings).mockResolvedValue(effectiveSettings({ conflictPolicy: 'reject' }))
    jest.mocked(findConflicts).mockResolvedValue([overlapWith()])
    const store = storeWith()

    const error = await rejection(moveBookingCommand.execute(input(), ctxFor(store)))

    expect(error.status).toBe(409)
    expect(store.booking?.startAt).toEqual(WARSAW_MIDNIGHT('2026-10-05'))
    expect(store.rolledBack).toBe(true)
  })

  it('undoes a move through the same check, so it can fail under reject', async () => {
    const before = {
      id: BOOKING_ID,
      ...SCOPE,
      targetId: TARGET_ID,
      subjectIds: [SUBJECT_ID],
      status: 'planned',
      startAt: WARSAW_MIDNIGHT('2026-10-05').toISOString(),
      endAt: WARSAW_MIDNIGHT('2026-10-08').toISOString(),
      durationValue: '3',
      durationUnit: 'working_days',
      expectedStartOn: '2026-10-05',
      lastWarnedWorkingDays: 2,
      note: null,
    }
    const moved = () => bookingOf({ startAt: WARSAW_MIDNIGHT('2026-10-12'), endAt: WARSAW_MIDNIGHT('2026-10-15') })

    const store = storeWith({ booking: moved() })
    await moveBookingCommand.undo!({ input: {} as never, ctx: ctxFor(store), logEntry: logEntryOf({ undo: { before } }) })
    expect(store.booking?.startAt).toEqual(WARSAW_MIDNIGHT('2026-10-05'))
    expect(findConflicts).toHaveBeenCalledWith(expect.anything(), SCOPE, expect.objectContaining({ days: { from: '2026-10-05', to: '2026-10-08' } }))

    jest.mocked(resolveEffectiveBookingsSettings).mockResolvedValue(effectiveSettings({ conflictPolicy: 'reject' }))
    jest.mocked(findConflicts).mockResolvedValue([overlapWith()])
    const blocked = storeWith({ booking: moved() })
    const error = await rejection(
      moveBookingCommand.undo!({ input: {} as never, ctx: ctxFor(blocked), logEntry: logEntryOf({ undo: { before } }) })
    )
    expect(error.status).toBe(409)
    expect(blocked.booking?.startAt).toEqual(WARSAW_MIDNIGHT('2026-10-12'))
  })
})
