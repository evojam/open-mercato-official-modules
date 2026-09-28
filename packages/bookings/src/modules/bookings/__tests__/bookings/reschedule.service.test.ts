import type { EntityManager } from '@mikro-orm/postgresql'
import { BookingParticipant } from '../../data/entities'
import { findConflicts } from '../../services/bookings/conflict-check.service'
import { syncParticipants, writeBooking } from '../../services/bookings/reschedule.service'
import type { OccupiedWindow } from '../../services/bookings/reschedule.service'
import { BOOKING_ID, OTHER_SUBJECT_ID, SCOPE, SUBJECT_ID, TARGET_ID, bookingOf, overlapWith, participantOf, rejection, subjectOf } from './booking-write.harness'

jest.mock('../../services/bookings/conflict-check.service', () => ({ findConflicts: jest.fn(async () => []) }))

function fakeEm(inTransaction = true) {
  const calls: string[] = []
  const em = {
    isInTransaction: () => inTransaction,
    execute: jest.fn(async (_sql: string, params: string[]) => {
      calls.push(params[0])
    }),
    begin: jest.fn(async () => {
      calls.push('begin')
    }),
    commit: jest.fn(async () => {
      calls.push('commit')
    }),
    rollback: jest.fn(async () => {
      calls.push('rollback')
    }),
    flush: jest.fn(async () => {
      calls.push('flush')
    }),
    create: jest.fn((entity: new () => object, data: object) => Object.assign(new entity(), data)),
    persist: jest.fn(),
  }
  return { em: em as unknown as EntityManager, calls, mocks: em }
}

const window = (overrides: Partial<OccupiedWindow> = {}): OccupiedWindow => ({
  bookingId: BOOKING_ID,
  targetName: 'Site A',
  subjectIds: [OTHER_SUBJECT_ID, SUBJECT_ID],
  days: { from: '2026-10-05', to: '2026-10-08' },
  status: 'planned',
  policy: 'advisory',
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(findConflicts).mockResolvedValue([])
})

describe('writeBooking', () => {
  it('locks the target, then the subjects in id order, checks, applies and commits in one transaction', async () => {
    const { em, calls } = fakeEm()
    const apply = jest.fn(() => {
      calls.push('apply')
    })

    const conflicts = await writeBooking(em, SCOPE, { targetId: TARGET_ID, window: window(), apply })

    expect(calls).toEqual(['begin', `bookings.target:${TARGET_ID}`, `bookings.subject:${SUBJECT_ID}`, `bookings.subject:${OTHER_SUBJECT_ID}`, 'apply', 'flush', 'commit'])
    expect(findConflicts).toHaveBeenCalledWith(em, SCOPE, {
      bookingId: BOOKING_ID,
      targetName: 'Site A',
      subjectIds: [OTHER_SUBJECT_ID, SUBJECT_ID],
      days: { from: '2026-10-05', to: '2026-10-08' },
      status: 'planned',
    })
    expect(conflicts).toEqual([])
  })

  it('locks only the target when there is no window to check', async () => {
    const { em, calls } = fakeEm()

    await writeBooking(em, SCOPE, { targetId: TARGET_ID, window: null, apply: () => undefined })

    expect(calls).toEqual(['begin', `bookings.target:${TARGET_ID}`, 'flush', 'commit'])
    expect(findConflicts).not.toHaveBeenCalled()
  })

  it('returns the clash under advisory and rolls back without applying under reject', async () => {
    jest.mocked(findConflicts).mockResolvedValue([overlapWith()])
    const advisory = fakeEm()
    expect(await writeBooking(advisory.em, SCOPE, { targetId: TARGET_ID, window: window(), apply: () => undefined })).toEqual([overlapWith()])

    const reject = fakeEm()
    const apply = jest.fn()
    const error = await rejection(writeBooking(reject.em, SCOPE, { targetId: TARGET_ID, window: window({ policy: 'reject' }), apply }))

    expect(error.status).toBe(409)
    expect(error.body).toMatchObject({ code: 'booking_conflict', details: { conflicts: [overlapWith()] } })
    expect(apply).not.toHaveBeenCalled()
    expect(reject.calls).toContain('rollback')
    expect(reject.calls).not.toContain('commit')
  })

  it('refuses to lock outside a transaction', async () => {
    const { em } = fakeEm(false)

    await expect(writeBooking(em, SCOPE, { targetId: TARGET_ID, window: null, apply: () => undefined })).rejects.toThrow(/transaction/)
  })
})

describe('syncParticipants', () => {
  it('soft-deletes the ones that left, adds the new ones and leaves the rest alone', () => {
    const { em, mocks } = fakeEm()
    const booking = bookingOf()
    const staying = subjectOf()
    const leaving = subjectOf({ id: '33333333-3333-4333-8333-111111111111' })
    const arriving = subjectOf({ id: OTHER_SUBJECT_ID })
    const current = [participantOf(booking, staying), participantOf(booking, leaving)]

    syncParticipants(em, SCOPE, booking, current, [staying, arriving])

    expect(current[0].deletedAt).toBeNull()
    expect(current[1].deletedAt).toBeInstanceOf(Date)
    expect(mocks.persist).toHaveBeenCalledTimes(1)
    const added = mocks.persist.mock.calls[0][0] as BookingParticipant
    expect(added).toBeInstanceOf(BookingParticipant)
    expect(added).toMatchObject({ ...SCOPE, booking, subject: arriving, role: 'performer' })
  })
})
