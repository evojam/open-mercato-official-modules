import { zonedDayStart } from '../../lib/time/date-fns.adapter'
import { bookingDays, unavailabilityDays } from '../../lib/time/day-ranges'

function utc(value: string): Date {
  return new Date(value)
}

describe('bookingDays', () => {
  it('reads back exactly the days a booking was placed on in its target zone', () => {
    const window = { from: zonedDayStart('2026-06-01', 'Europe/Warsaw'), to: zonedDayStart('2026-06-04', 'Europe/Warsaw') }

    expect(bookingDays(window, 'Europe/Warsaw')).toEqual({ from: '2026-06-01', to: '2026-06-04' })
  })

  it('keeps its days across a clock change', () => {
    const window = { from: zonedDayStart('2026-03-28', 'Europe/Warsaw'), to: zonedDayStart('2026-03-31', 'Europe/Warsaw') }

    expect(bookingDays(window, 'Europe/Warsaw')).toEqual({ from: '2026-03-28', to: '2026-03-31' })
  })

  it('covers every day an hourly window touches', () => {
    const window = { from: utc('2026-06-01T21:00:00.000Z'), to: utc('2026-06-01T23:00:00.000Z') }

    expect(bookingDays(window, 'Europe/Warsaw')).toEqual({ from: '2026-06-01', to: '2026-06-03' })
  })

  it.each([
    ['inverted', { from: utc('2026-06-03T00:00:00.000Z'), to: utc('2026-06-01T00:00:00.000Z') }],
    ['empty', { from: utc('2026-06-01T00:00:00.000Z'), to: utc('2026-06-01T00:00:00.000Z') }],
    ['unparseable', { from: new Date('nonsense'), to: utc('2026-06-01T00:00:00.000Z') }],
  ])('returns null for an %s window', (_, window) => {
    expect(bookingDays(window, 'Europe/Warsaw')).toBeNull()
  })
})

describe('unavailabilityDays', () => {
  it('puts a leave HR stored at UTC midnight on its own day east of UTC', () => {
    const window = { from: utc('2026-06-01T00:00:00.000Z'), to: utc('2026-06-02T00:00:00.000Z') }

    expect(unavailabilityDays(window, 'Europe/Warsaw')).toEqual({ from: '2026-06-01', to: '2026-06-02' })
  })

  it('puts an inspection a Warsaw editor stored at local midnight on its own day', () => {
    const window = { from: utc('2026-05-31T22:00:00.000Z'), to: utc('2026-06-01T22:00:00.000Z') }

    expect(unavailabilityDays(window, 'Europe/Warsaw')).toEqual({ from: '2026-06-01', to: '2026-06-02' })
  })

  it('puts the same leave on the same day west of UTC', () => {
    const window = { from: utc('2026-06-01T00:00:00.000Z'), to: utc('2026-06-02T00:00:00.000Z') }

    expect(unavailabilityDays(window, 'America/New_York')).toEqual({ from: '2026-06-01', to: '2026-06-02' })
  })

  it('reads a three-day leave as three days, not four', () => {
    const window = { from: utc('2026-06-01T00:00:00.000Z'), to: utc('2026-06-04T00:00:00.000Z') }

    expect(unavailabilityDays(window, 'Europe/Warsaw')).toEqual({ from: '2026-06-01', to: '2026-06-04' })
  })

  it('covers every day a window with real hours touches', () => {
    const window = { from: utc('2026-06-01T21:00:00.000Z'), to: utc('2026-06-01T23:00:00.000Z') }

    expect(unavailabilityDays(window, 'Europe/Warsaw')).toEqual({ from: '2026-06-01', to: '2026-06-03' })
  })

  it('returns null for an inverted window', () => {
    const window = { from: utc('2026-06-02T00:00:00.000Z'), to: utc('2026-06-01T00:00:00.000Z') }

    expect(unavailabilityDays(window, 'Europe/Warsaw')).toBeNull()
  })
})
