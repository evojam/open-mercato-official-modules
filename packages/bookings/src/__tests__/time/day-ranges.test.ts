import { bookingDays, dayStartIn, todayIn, unavailabilityDays } from '../../lib/time/day-ranges'

function utc(value: string): Date {
  return new Date(value)
}

function zones(subject: string, organization = 'Europe/Warsaw') {
  return { subject, organization }
}

describe('todayIn', () => {
  it('gives each place its own today at the same instant', () => {
    const now = utc('2026-06-01T22:30:00.000Z')

    expect(todayIn(now, 'Europe/Lisbon')).toBe('2026-06-01')
    expect(todayIn(now, 'Europe/Warsaw')).toBe('2026-06-02')
    expect(todayIn(now, 'Pacific/Auckland')).toBe('2026-06-02')
  })
})

describe('bookingDays', () => {
  it('reads back exactly the days a booking was placed on in its target zone', () => {
    const window = { from: dayStartIn('2026-06-01', 'Europe/Warsaw'), to: dayStartIn('2026-06-04', 'Europe/Warsaw') }

    expect(bookingDays(window, 'Europe/Warsaw')).toEqual({ from: '2026-06-01', to: '2026-06-04' })
  })

  it('keeps its days across a clock change', () => {
    const window = { from: dayStartIn('2026-03-28', 'Europe/Warsaw'), to: dayStartIn('2026-03-31', 'Europe/Warsaw') }

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
  const hrMonday = { from: utc('2026-06-01T00:00:00.000Z'), to: utc('2026-06-02T00:00:00.000Z') }

  it.each(['Europe/Warsaw', 'Europe/Lisbon', 'America/New_York', 'Pacific/Auckland', 'Pacific/Tongatapu', 'Pacific/Kiritimati'])(
    'puts a leave HR stored at UTC midnight on its own day for a subject in %s',
    (subject) => {
      expect(unavailabilityDays(hrMonday, zones(subject))).toEqual({ from: '2026-06-01', to: '2026-06-02' })
    }
  )

  it('puts a leave HR stored at UTC midnight on its own day in the southern summer', () => {
    const window = { from: utc('2026-01-12T00:00:00.000Z'), to: utc('2026-01-13T00:00:00.000Z') }

    expect(unavailabilityDays(window, zones('Pacific/Auckland'))).toEqual({ from: '2026-01-12', to: '2026-01-13' })
  })

  it('reads a three-day leave as three days, not four', () => {
    const window = { from: utc('2026-06-01T00:00:00.000Z'), to: utc('2026-06-04T00:00:00.000Z') }

    expect(unavailabilityDays(window, zones('Europe/Warsaw'))).toEqual({ from: '2026-06-01', to: '2026-06-04' })
  })

  it('reads a window our form wrote at the subject midnight, even across a clock change', () => {
    const window = { from: dayStartIn('2026-04-04', 'Pacific/Auckland'), to: dayStartIn('2026-04-07', 'Pacific/Auckland') }

    expect(window.to.getTime() - window.from.getTime()).toBe(73 * 60 * 60 * 1000)
    expect(unavailabilityDays(window, zones('Pacific/Auckland'))).toEqual({ from: '2026-04-04', to: '2026-04-07' })
  })

  it('reads a window a planner editor wrote at the organization midnight', () => {
    const window = { from: utc('2026-05-31T22:00:00.000Z'), to: utc('2026-06-01T22:00:00.000Z') }

    expect(unavailabilityDays(window, zones('Europe/Lisbon', 'Europe/Warsaw'))).toEqual({
      from: '2026-06-01',
      to: '2026-06-02',
    })
  })

  it('falls back to the middle of a whole-day window written at a midnight nobody here owns', () => {
    const window = { from: utc('2026-06-01T04:00:00.000Z'), to: utc('2026-06-02T04:00:00.000Z') }

    expect(unavailabilityDays(window, zones('Europe/Warsaw'))).toEqual({ from: '2026-06-01', to: '2026-06-02' })
  })

  it('covers every day a window with real hours touches', () => {
    const window = { from: utc('2026-06-01T21:00:00.000Z'), to: utc('2026-06-01T23:00:00.000Z') }

    expect(unavailabilityDays(window, zones('Europe/Warsaw'))).toEqual({ from: '2026-06-01', to: '2026-06-03' })
  })

  it('treats a window from UTC midnight to a later hour as hours, not as a day', () => {
    const window = { from: utc('2026-06-01T00:00:00.000Z'), to: utc('2026-06-01T08:00:00.000Z') }

    expect(unavailabilityDays(window, zones('Pacific/Auckland'))).toEqual({ from: '2026-06-01', to: '2026-06-02' })
  })

  it('returns null for an inverted window', () => {
    const window = { from: utc('2026-06-02T00:00:00.000Z'), to: utc('2026-06-01T00:00:00.000Z') }

    expect(unavailabilityDays(window, zones('Europe/Warsaw'))).toBeNull()
  })
})
