import { changeBookingStatusCommand } from '../../commands/bookings/change-booking-status.command'
import { emitBookingsEvent } from '../../events'
import { findConflicts } from '../../services/bookings/conflict-check.service'
import { lockSubjects } from '../../services/bookings/subject-lock'
import { resolveEffectiveBookingsSettings } from '../../services/settings/effective-settings'
import { BOOKING_ID, SCOPE, bookingOf, ctxFor, effectiveSettings, overlapWith, rejection, storeWith } from './booking-write.harness'

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

const input = (status: string) => ({ ...SCOPE, id: BOOKING_ID, status }) as never

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(resolveEffectiveBookingsSettings).mockResolvedValue(effectiveSettings())
  jest.mocked(findConflicts).mockResolvedValue([])
})

describe('bookings.bookings.change-status', () => {
  it('moves a planned booking to active without touching occupancy', async () => {
    const store = storeWith()

    await changeBookingStatusCommand.execute(input('active'), ctxFor(store))

    expect(store.booking?.status).toBe('active')
    expect(lockSubjects).not.toHaveBeenCalled()
    expect(findConflicts).not.toHaveBeenCalled()
    expect(emitBookingsEvent).toHaveBeenCalledWith('bookings.booking.updated', expect.objectContaining({ id: BOOKING_ID, status: 'active' }), { persistent: true })
  })

  it('closes a booking and frees its slot; cancel has its own event', async () => {
    const completed = storeWith({ booking: bookingOf({ status: 'active' }) })
    await changeBookingStatusCommand.execute(input('completed'), ctxFor(completed))
    expect(completed.booking?.status).toBe('completed')

    const cancelled = storeWith()
    await changeBookingStatusCommand.execute(input('cancelled'), ctxFor(cancelled))
    expect(cancelled.booking?.status).toBe('cancelled')
    expect(emitBookingsEvent).toHaveBeenLastCalledWith('bookings.booking.cancelled', expect.objectContaining({ status: 'cancelled' }), { persistent: true })
    expect(findConflicts).not.toHaveBeenCalled()
  })

  it('reopens a placed booking through the conflict check and can be refused under reject', async () => {
    const store = storeWith({ booking: bookingOf({ status: 'completed' }) })
    await changeBookingStatusCommand.execute(input('planned'), ctxFor(store))
    expect(store.booking?.status).toBe('planned')
    expect(findConflicts).toHaveBeenCalledWith(expect.anything(), SCOPE, expect.objectContaining({ status: 'planned', days: { from: '2026-10-05', to: '2026-10-08' } }))

    jest.mocked(resolveEffectiveBookingsSettings).mockResolvedValue(effectiveSettings({ conflictPolicy: 'reject' }))
    jest.mocked(findConflicts).mockResolvedValue([overlapWith()])
    const blocked = storeWith({ booking: bookingOf({ status: 'no_show' }) })
    const error = await rejection(changeBookingStatusCommand.execute(input('active'), ctxFor(blocked)))
    expect(error.status).toBe(409)
    expect(blocked.booking?.status).toBe('no_show')
  })

  it('reopens an unplaced booking without a conflict check', async () => {
    const store = storeWith({ booking: bookingOf({ status: 'completed', startAt: null, endAt: null }) })

    await changeBookingStatusCommand.execute(input('planned'), ctxFor(store))

    expect(store.booking?.status).toBe('planned')
    expect(findConflicts).not.toHaveBeenCalled()
  })

  it('refuses every transition outside the matrix with 422', async () => {
    const backwards = await rejection(changeBookingStatusCommand.execute(input('planned'), ctxFor(storeWith({ booking: bookingOf({ status: 'active' }) }))))
    const fromCancelled = await rejection(changeBookingStatusCommand.execute(input('planned'), ctxFor(storeWith({ booking: bookingOf({ status: 'cancelled' }) }))))
    const same = await rejection(changeBookingStatusCommand.execute(input('planned'), ctxFor(storeWith())))

    for (const error of [backwards, fromCancelled, same]) {
      expect(error.status).toBe(422)
      expect(error.body).toMatchObject({ code: 'invalid_transition' })
    }
    expect(backwards.body).toMatchObject({ details: { from: 'active', to: 'planned' } })
  })

  it('rejects an unknown status', async () => {
    const error = await rejection(changeBookingStatusCommand.execute(input('done'), ctxFor(storeWith())))

    expect(error.status).toBe(400)
  })
})
