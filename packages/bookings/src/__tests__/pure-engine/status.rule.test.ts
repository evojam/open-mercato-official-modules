import {
  BOOKING_STATUSES,
  NEXT_BOOKING_STATUSES,
  canTransition,
  reopens,
  type BookingStatus,
} from '../../lib/pure-engine'

const ALLOWED: ReadonlyArray<readonly [BookingStatus, BookingStatus]> = [
  ['planned', 'active'],
  ['planned', 'completed'],
  ['planned', 'cancelled'],
  ['planned', 'no_show'],
  ['active', 'completed'],
  ['active', 'cancelled'],
  ['active', 'no_show'],
  ['completed', 'planned'],
  ['completed', 'active'],
  ['no_show', 'planned'],
  ['no_show', 'active'],
]

const everyPair = BOOKING_STATUSES.flatMap((from) => BOOKING_STATUSES.map((to) => [from, to] as const))

describe('canTransition', () => {
  it.each(everyPair)('%s → %s follows the spec matrix', (from, to) => {
    const expected = ALLOWED.some(([a, b]) => a === from && b === to)

    expect(canTransition(from, to)).toBe(expected)
  })

  it('leaves cancelled with no way out', () => {
    expect(NEXT_BOOKING_STATUSES.cancelled).toEqual([])
  })

  it('rejects staying in the same status', () => {
    for (const status of BOOKING_STATUSES) expect(canTransition(status, status)).toBe(false)
  })
})

describe('reopens', () => {
  it('is true only when a closed booking takes the slot again', () => {
    expect(reopens('completed', 'planned')).toBe(true)
    expect(reopens('no_show', 'active')).toBe(true)
    expect(reopens('planned', 'active')).toBe(false)
    expect(reopens('active', 'completed')).toBe(false)
    expect(reopens('cancelled', 'planned')).toBe(true)
  })
})
