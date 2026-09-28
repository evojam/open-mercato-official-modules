import { updateBookingCommand } from '../../commands/bookings/update-booking.command'
import { BookingParticipant } from '../../data/entities'
import { emitBookingsEvent } from '../../events'
import { findConflicts } from '../../services/bookings/conflict-check.service'
import { lockSubjects, lockTarget } from '../../services/bookings/subject-lock'
import { resolveEffectiveBookingsSettings } from '../../services/settings/effective-settings'
import {
  BOOKING_ID,
  OTHER_SUBJECT_ID,
  OTHER_TARGET_ID,
  SCOPE,
  SUBJECT_ID,
  TARGET_ID,
  WARSAW_MIDNIGHT,
  bookingOf,
  ctxFor,
  effectiveSettings,
  overlapWith,
  rejection,
  storeWith,
  subjectOf,
  targetOf,
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

const input = (overrides: Record<string, unknown>) => ({ ...SCOPE, id: BOOKING_ID, ...overrides }) as never

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(resolveEffectiveBookingsSettings).mockResolvedValue(effectiveSettings())
  jest.mocked(findConflicts).mockResolvedValue([])
})

describe('bookings.bookings.update', () => {
  it('edits the note and the expected start without touching occupancy', async () => {
    const store = storeWith()

    await updateBookingCommand.execute(input({ note: 'Bring the long boom', expectedStartOn: '2026-10-07' }), ctxFor(store))

    expect(store.booking).toMatchObject({ note: 'Bring the long boom', expectedStartOn: '2026-10-07', startAt: WARSAW_MIDNIGHT('2026-10-05') })
    expect(lockTarget).toHaveBeenCalledWith(expect.anything(), TARGET_ID)
    expect(lockSubjects).not.toHaveBeenCalled()
    expect(findConflicts).not.toHaveBeenCalled()
    expect(store.participants.every((participant) => !participant.deletedAt)).toBe(true)
    expect(emitBookingsEvent).toHaveBeenCalledWith('bookings.booking.updated', expect.objectContaining({ id: BOOKING_ID }), { persistent: true })
  })

  it('swaps the participant, checks the new subject against the window and keeps the row history', async () => {
    const other = subjectOf({ id: OTHER_SUBJECT_ID, name: 'Crane' })
    const store = storeWith({ subjects: [subjectOf(), other] })
    store.participants = store.participants.filter((participant) => participant.subject.id === SUBJECT_ID)

    await updateBookingCommand.execute(input({ subjectIds: [OTHER_SUBJECT_ID] }), ctxFor(store))

    expect(lockSubjects).toHaveBeenCalledWith(expect.anything(), [OTHER_SUBJECT_ID])
    expect(findConflicts).toHaveBeenCalledWith(expect.anything(), SCOPE, expect.objectContaining({ subjectIds: [OTHER_SUBJECT_ID], days: { from: '2026-10-05', to: '2026-10-08' } }))
    expect(store.participants[0].deletedAt).toBeInstanceOf(Date)
    const added = store.persisted.filter((record) => record instanceof BookingParticipant) as BookingParticipant[]
    expect(added.map((participant) => participant.subject.id)).toEqual([OTHER_SUBJECT_ID])
  })

  it('resending the same participant changes nothing in occupancy', async () => {
    const store = storeWith()

    await updateBookingCommand.execute(input({ subjectIds: [SUBJECT_ID] }), ctxFor(store))

    expect(findConflicts).not.toHaveBeenCalled()
    expect(store.persisted).toEqual([])
    expect(store.participants[0].deletedAt).toBeNull()
  })

  it('moves the booking to a target in another zone and recomputes the instants for the same days', async () => {
    const kyiv = targetOf({ id: OTHER_TARGET_ID, name: 'Kyiv site', timeZone: 'Europe/Kyiv' })
    const store = storeWith({ targets: [targetOf(), kyiv] })

    await updateBookingCommand.execute(input({ targetId: OTHER_TARGET_ID }), ctxFor(store))

    expect(store.booking?.target).toBe(kyiv)
    expect(store.booking?.startAt).toEqual(new Date('2026-10-04T21:00:00.000Z'))
    expect(store.booking?.endAt).toEqual(new Date('2026-10-07T21:00:00.000Z'))
    expect(lockTarget).toHaveBeenCalledWith(expect.anything(), OTHER_TARGET_ID)
    expect(findConflicts).toHaveBeenCalledWith(expect.anything(), SCOPE, expect.objectContaining({ targetName: 'Kyiv site', days: { from: '2026-10-05', to: '2026-10-08' } }))
  })

  it('refuses a new subject that clashes under reject and keeps the old participant', async () => {
    jest.mocked(resolveEffectiveBookingsSettings).mockResolvedValue(effectiveSettings({ conflictPolicy: 'reject' }))
    jest.mocked(findConflicts).mockResolvedValue([overlapWith(OTHER_SUBJECT_ID)])
    const store = storeWith({ subjects: [subjectOf(), subjectOf({ id: OTHER_SUBJECT_ID })] })
    store.participants = store.participants.filter((participant) => participant.subject.id === SUBJECT_ID)

    const error = await rejection(updateBookingCommand.execute(input({ subjectIds: [OTHER_SUBJECT_ID] }), ctxFor(store)))

    expect(error.status).toBe(409)
    expect(store.participants[0].deletedAt).toBeNull()
    expect(store.rolledBack).toBe(true)
  })

  it('refuses a closed booking, an unknown target and an empty edit', async () => {
    const closed = await rejection(updateBookingCommand.execute(input({ note: 'x' }), ctxFor(storeWith({ booking: bookingOf({ status: 'completed' }) }))))
    const noTarget = await rejection(updateBookingCommand.execute(input({ targetId: OTHER_TARGET_ID }), ctxFor(storeWith())))
    const empty = await rejection(updateBookingCommand.execute(input({}), ctxFor(storeWith())))

    expect(closed.body).toMatchObject({ code: 'booking_closed' })
    expect(noTarget.status).toBe(404)
    expect(empty.status).toBe(400)
  })
})
