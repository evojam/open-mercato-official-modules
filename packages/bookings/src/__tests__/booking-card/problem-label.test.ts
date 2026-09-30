import { leadingProblemKind, problemKindsOf, problemSeverity } from '../../lib/booking-card'
import type { Conflict } from '../../lib/pure-engine'

const overlap = (withTargetId: string): Conflict => ({
  kind: 'overlap',
  subjectId: 's1',
  bookingId: 'b1',
  withBookingId: 'b2',
  withTargetId,
  from: '2026-02-05',
  to: '2026-02-06',
})

const unavailable: Conflict = {
  kind: 'unavailability',
  subjectId: 's1',
  bookingId: 'b1',
  withWindowId: 'w1',
  from: '2026-02-05',
  to: '2026-02-06',
}

describe('problem kinds', () => {
  it('tells a clash at the same target from a clash at another one', () => {
    expect(problemKindsOf([overlap('t1'), overlap('t2'), unavailable], 't1')).toEqual([
      'overlap_same_target',
      'overlap_other_target',
      'unavailability',
    ])
  })

  it('names the most urgent problem when a booking has several', () => {
    expect(leadingProblemKind(['unavailability', 'overlap_same_target'])).toBe('overlap_same_target')
    expect(leadingProblemKind(['overlap_same_target', 'overlap_other_target'])).toBe('overlap_other_target')
    expect(leadingProblemKind([])).toBeNull()
  })

  it('sorts a booking without problems after every problem', () => {
    expect(problemSeverity(['overlap_other_target'])).toBeLessThan(problemSeverity(['unavailability']))
    expect(problemSeverity([])).toBe(3)
  })
})
