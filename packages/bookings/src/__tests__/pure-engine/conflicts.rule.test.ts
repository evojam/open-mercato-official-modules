import { detectConflicts, overlaps } from '../../lib/pure-engine'
import type { Placement, UnavailabilityWindow } from '../../lib/pure-engine'

const MAREK = 'subject-marek'
const AUTO = 'subject-auto'

function placement(overrides: Partial<Placement> & Pick<Placement, 'bookingId' | 'from' | 'to'>): Placement {
  return {
    subjectId: MAREK,
    status: 'planned',
    targetName: 'Jan Kowalski',
    ...overrides,
  }
}

function day(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

describe('detectConflicts — overlapping bookings', () => {
  it('reports a conflict for both bookings when one subject is booked twice over the same days', () => {
    const placements = [
      placement({ bookingId: 'a', from: day('2026-09-23'), to: day('2026-09-25') }),
      placement({ bookingId: 'b', from: day('2026-09-24'), to: day('2026-09-26'), targetName: 'Adam Nowak' }),
    ]

    const conflicts = detectConflicts({ placements })

    expect(conflicts).toHaveLength(2)
    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'overlap', bookingId: 'a', withBookingId: 'b', withTargetName: 'Adam Nowak' }),
        expect.objectContaining({ kind: 'overlap', bookingId: 'b', withBookingId: 'a', withTargetName: 'Jan Kowalski' }),
      ])
    )
  })

  it('reports the overlapping range, not the whole booking', () => {
    const placements = [
      placement({ bookingId: 'a', from: day('2026-09-23'), to: day('2026-09-25') }),
      placement({ bookingId: 'b', from: day('2026-09-24'), to: day('2026-09-26') }),
    ]

    const [first] = detectConflicts({ placements })

    expect(first.from).toEqual(day('2026-09-24'))
    expect(first.to).toEqual(day('2026-09-25'))
  })

  it('treats touching bookings as free, because the interval is open on the right', () => {
    const placements = [
      placement({ bookingId: 'a', from: day('2026-09-23'), to: day('2026-09-25') }),
      placement({ bookingId: 'b', from: day('2026-09-25'), to: day('2026-09-26') }),
    ]

    expect(detectConflicts({ placements })).toEqual([])
  })

  it('does not mix subjects: two subjects booked over the same days are both free', () => {
    const placements = [
      placement({ bookingId: 'a', from: day('2026-09-23'), to: day('2026-09-25') }),
      placement({ bookingId: 'b', subjectId: AUTO, from: day('2026-09-23'), to: day('2026-09-25') }),
    ]

    expect(detectConflicts({ placements })).toEqual([])
  })

  it('does not report a booking against itself when the same subject is listed twice', () => {
    const placements = [
      placement({ bookingId: 'a', from: day('2026-09-23'), to: day('2026-09-25') }),
      placement({ bookingId: 'a', from: day('2026-09-23'), to: day('2026-09-25') }),
    ]

    expect(detectConflicts({ placements })).toEqual([])
  })

  it('finds a conflict hidden behind a long booking that swallows a shorter one', () => {
    const placements = [
      placement({ bookingId: 'long', from: day('2026-09-21'), to: day('2026-09-30') }),
      placement({ bookingId: 'short', from: day('2026-09-22'), to: day('2026-09-23') }),
      placement({ bookingId: 'late', from: day('2026-09-28'), to: day('2026-09-29') }),
    ]

    const pairs = detectConflicts({ placements })
      .filter((conflict) => conflict.kind === 'overlap')
      .map((conflict) => [conflict.bookingId, conflict.withBookingId].sort().join('+'))

    expect(new Set(pairs)).toEqual(new Set(['long+short', 'late+long']))
  })

  it('agrees with a naive comparison of every pair, on a shuffled input', () => {
    const placements = Array.from({ length: 40 }, (_, index) =>
      placement({
        bookingId: `b${index}`,
        from: day(`2026-09-${String((index % 20) + 1).padStart(2, '0')}`),
        to: day(`2026-09-${String((index % 20) + 3).padStart(2, '0')}`),
      })
    ).sort(() => Math.random() - 0.5)

    const naive = placements.flatMap((left, index) =>
      placements.slice(index + 1).filter((right) => overlaps(left, right))
    ).length

    const reported = detectConflicts({ placements }).filter(
      (conflict) => conflict.kind === 'overlap'
    ).length

    expect(reported).toBe(naive * 2)
  })

  it('ignores a booking whose window is inverted or unparseable', () => {
    const placements = [
      placement({ bookingId: 'sane', from: day('2026-09-23'), to: day('2026-09-25') }),
      placement({ bookingId: 'inverted', from: day('2026-09-26'), to: day('2026-09-22') }),
      placement({ bookingId: 'broken', from: new Date('nonsense'), to: day('2026-09-25') }),
    ]

    expect(detectConflicts({ placements })).toEqual([])
  })

  it.each(['cancelled', 'completed', 'no_show'] as const)(
    'ignores a %s booking, because a closed booking holds nothing',
    (status) => {
      const placements = [
        placement({ bookingId: 'a', from: day('2026-09-23'), to: day('2026-09-25') }),
        placement({ bookingId: 'b', status, from: day('2026-09-24'), to: day('2026-09-26') }),
      ]

      expect(detectConflicts({ placements })).toEqual([])
    }
  )

  it('reports every pair when one subject is booked three times over the same days', () => {
    const placements = [
      placement({ bookingId: 'a', from: day('2026-09-23'), to: day('2026-09-26') }),
      placement({ bookingId: 'b', from: day('2026-09-24'), to: day('2026-09-26') }),
      placement({ bookingId: 'c', from: day('2026-09-25'), to: day('2026-09-26') }),
    ]

    expect(detectConflicts({ placements })).toHaveLength(6)
  })
})

describe('detectConflicts — unavailability', () => {
  const leave: UnavailabilityWindow = {
    windowId: 'window-leave',
    subjectId: MAREK,
    from: day('2026-09-24'),
    to: day('2026-09-29'),
    reasonLabel: 'Urlop',
  }

  it('reports a booking that falls into an unavailability window of its subject', () => {
    const placements = [placement({ bookingId: 'a', from: day('2026-09-23'), to: day('2026-09-25') })]

    const conflicts = detectConflicts({ placements, unavailability: [leave] })

    expect(conflicts).toEqual([
      expect.objectContaining({
        kind: 'unavailability',
        bookingId: 'a',
        subjectId: MAREK,
        reasonLabel: 'Urlop',
        withWindowId: 'window-leave',
        from: day('2026-09-24'),
        to: day('2026-09-25'),
      }),
    ])
  })

  it('counts an active booking as holding its slot, like a planned one', () => {
    const placements = [placement({ bookingId: 'a', status: 'active', from: day('2026-09-23'), to: day('2026-09-25') })]

    expect(detectConflicts({ placements, unavailability: [leave] })).toHaveLength(1)
  })

  it('ignores a closed booking that falls into an unavailability window', () => {
    const placements = [
      placement({ bookingId: 'a', status: 'cancelled', from: day('2026-09-23'), to: day('2026-09-25') }),
    ]

    expect(detectConflicts({ placements, unavailability: [leave] })).toEqual([])
  })

  it('ignores an unavailability window of another subject', () => {
    const placements = [placement({ bookingId: 'a', subjectId: AUTO, from: day('2026-09-23'), to: day('2026-09-25') })]

    expect(detectConflicts({ placements, unavailability: [leave] })).toEqual([])
  })

  it('treats a booking touching the start of a window as free', () => {
    const placements = [placement({ bookingId: 'a', from: day('2026-09-22'), to: day('2026-09-24') })]

    expect(detectConflicts({ placements, unavailability: [leave] })).toEqual([])
  })

  it('reports both kinds for the same booking when they happen together', () => {
    const placements = [
      placement({ bookingId: 'a', from: day('2026-09-23'), to: day('2026-09-25') }),
      placement({ bookingId: 'b', from: day('2026-09-24'), to: day('2026-09-26') }),
    ]

    const conflicts = detectConflicts({ placements, unavailability: [leave] })

    expect(conflicts.filter((conflict) => conflict.kind === 'overlap')).toHaveLength(2)
    expect(conflicts.filter((conflict) => conflict.kind === 'unavailability')).toHaveLength(2)
  })

  it('answers with an empty list when nothing was passed', () => {
    expect(detectConflicts({ placements: [] })).toEqual([])
  })

  it('leaves its input untouched, so a caller may reuse the same arrays', () => {
    const placements = [
      placement({ bookingId: 'b', from: day('2026-09-24'), to: day('2026-09-26') }),
      placement({ bookingId: 'a', from: day('2026-09-23'), to: day('2026-09-25') }),
    ]
    const unavailability = [leave]
    const beforePlacements = JSON.stringify(placements)
    const beforeWindows = JSON.stringify(unavailability)

    detectConflicts({ placements, unavailability })

    expect(JSON.stringify(placements)).toBe(beforePlacements)
    expect(JSON.stringify(unavailability)).toBe(beforeWindows)
  })
})
