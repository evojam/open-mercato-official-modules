import { resizeBookingCommand } from '../../commands/bookings/resize-booking.command'
import { emitBookingsEvent } from '../../events'
import { findConflicts } from '../../services/bookings/conflict-check.service'
import { lockSubjects, lockTarget } from '../../services/bookings/subject-lock'
import { resolveEffectiveBookingsSettings } from '../../services/settings/effective-settings'
import { BOOKING_ID, SCOPE, TARGET_ID, WARSAW_MIDNIGHT, bookingOf, ctxFor, effectiveSettings, rejection, storeWith } from './booking-write.harness'

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

const input = (overrides: Record<string, unknown> = {}) => ({ ...SCOPE, id: BOOKING_ID, durationValue: 5, ...overrides }) as never

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(resolveEffectiveBookingsSettings).mockResolvedValue(effectiveSettings())
  jest.mocked(findConflicts).mockResolvedValue([])
})

describe('bookings.bookings.resize', () => {
  it('keeps the start and computes a new end from the new working days', async () => {
    const store = storeWith()

    await resizeBookingCommand.execute(input(), ctxFor(store))

    expect(store.booking).toMatchObject({
      startAt: WARSAW_MIDNIGHT('2026-10-05'),
      endAt: WARSAW_MIDNIGHT('2026-10-10'),
      durationValue: '5',
    })
    expect(findConflicts).toHaveBeenCalledWith(expect.anything(), SCOPE, expect.objectContaining({ days: { from: '2026-10-05', to: '2026-10-10' } }))
    expect(emitBookingsEvent).toHaveBeenCalledWith('bookings.booking.resized', expect.objectContaining({ id: BOOKING_ID }), { persistent: true })
  })

  it('changes only the number on an unplaced booking and skips the subject lock', async () => {
    const store = storeWith({ booking: bookingOf({ startAt: null, endAt: null }) })

    await resizeBookingCommand.execute(input({ durationValue: 1.5 }), ctxFor(store))

    expect(store.booking).toMatchObject({ durationValue: '1.5', startAt: null, endAt: null })
    expect(lockTarget).toHaveBeenCalledWith(expect.anything(), TARGET_ID)
    expect(lockSubjects).not.toHaveBeenCalled()
    expect(findConflicts).not.toHaveBeenCalled()
  })

  it('refuses a closed booking and a quarter day', async () => {
    const closed = await rejection(resizeBookingCommand.execute(input(), ctxFor(storeWith({ booking: bookingOf({ status: 'no_show' }) }))))
    const quarter = await rejection(resizeBookingCommand.execute(input({ durationValue: 1.25 }), ctxFor(storeWith())))

    expect(closed.body).toMatchObject({ code: 'booking_closed' })
    expect(quarter.status).toBe(400)
  })
})
