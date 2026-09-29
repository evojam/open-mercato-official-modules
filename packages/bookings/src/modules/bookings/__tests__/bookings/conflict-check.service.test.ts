import type { EntityManager } from '@mikro-orm/postgresql'
import { findConflicts } from '../../services/bookings/conflict-check.service'
import { BOOKING_ID, OTHER_TARGET_ID, SCOPE, SUBJECT_ID, WARSAW_MIDNIGHT } from './booking-write.harness'

const OTHER_BOOKING_ID = '55555555-5555-4555-8555-999999999999'

function fakeEm(rows: unknown[] = []) {
  const find = jest.fn(async () => rows)
  return { em: { find } as unknown as EntityManager, find }
}

function bookingFilterOf(find: jest.Mock) {
  const [, where] = find.mock.calls[0] as [unknown, { booking: Record<string, unknown> }]
  return where.booking
}

function overlapping(bookingId: string) {
  return {
    subject: { id: SUBJECT_ID },
    booking: {
      id: bookingId,
      status: 'planned',
      startAt: WARSAW_MIDNIGHT('2026-10-06'),
      endAt: WARSAW_MIDNIGHT('2026-10-08'),
      target: { id: OTHER_TARGET_ID, name: 'Site B', timeZone: 'Europe/Warsaw' },
    },
  }
}

const candidate = {
  subjectIds: [SUBJECT_ID],
  days: { from: '2026-10-05', to: '2026-10-07' },
  status: 'planned' as const,
}

describe('findConflicts', () => {
  it('puts no id filter on the query when previewing a booking that does not exist yet', async () => {
    const { em, find } = fakeEm([overlapping(OTHER_BOOKING_ID)])

    const conflicts = await findConflicts(em, SCOPE, candidate)

    expect(bookingFilterOf(find)).not.toHaveProperty('id')
    expect(conflicts).toEqual([
      expect.objectContaining({ kind: 'overlap', subjectId: SUBJECT_ID, withBookingId: OTHER_BOOKING_ID, withTargetId: OTHER_TARGET_ID, withTargetName: 'Site B' }),
    ])
  })

  it('leaves the edited booking out of the query so it does not clash with itself', async () => {
    const { em, find } = fakeEm()

    await findConflicts(em, SCOPE, { ...candidate, bookingId: BOOKING_ID })

    expect(bookingFilterOf(find)).toMatchObject({ id: { $ne: BOOKING_ID } })
  })
})
