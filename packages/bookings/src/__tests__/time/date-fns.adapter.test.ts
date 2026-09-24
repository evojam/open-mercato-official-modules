import {
  addDays,
  isValidTimeZone,
  toZonedIsoDate,
  weekdayOf,
  zonedDayStart,
  zonedWallTimeToInstant,
} from '../../lib/time/date-fns.adapter'

describe('addDays', () => {
  it.each([
    ['2026-02-28', 1, '2026-03-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-03-28', 1, '2026-03-29'],
    ['2026-10-24', 2, '2026-10-26'],
  ])('%s %+d days is %s', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected)
  })

  it.each(['2026-02-30', '2026-13-01', '26-09-24', '2026-09-24T00:00:00Z', ''])(
    'rejects %p as not a calendar date',
    (date) => {
      expect(() => addDays(date, 1)).toThrow(TypeError)
    }
  )
})

describe('weekdayOf', () => {
  it.each([
    ['2026-09-27', 0],
    ['2026-09-28', 1],
    ['2026-09-24', 4],
    ['2026-09-26', 6],
  ])('%s is weekday %d', (date, expected) => {
    expect(weekdayOf(date)).toBe(expected)
  })
})

describe('isValidTimeZone', () => {
  it.each(['Europe/Warsaw', 'Europe/Lisbon', 'UTC', 'Etc/GMT-3'])('accepts %s', (zone) => {
    expect(isValidTimeZone(zone)).toBe(true)
  })

  it.each(['', 'GMT+3', 'Mars/Olympus', 'europe warsaw'])('rejects %p', (zone) => {
    expect(isValidTimeZone(zone)).toBe(false)
  })
})

describe('toZonedIsoDate', () => {
  it('puts one instant on different days in Lisbon and Warsaw', () => {
    const lateEvening = new Date('2026-06-01T22:30:00.000Z')

    expect(toZonedIsoDate(lateEvening, 'Europe/Lisbon')).toBe('2026-06-01')
    expect(toZonedIsoDate(lateEvening, 'Europe/Warsaw')).toBe('2026-06-02')
  })

  it('reads the Warsaw day from the midnight a Warsaw editor stores in summer', () => {
    expect(toZonedIsoDate(new Date('2026-05-31T22:00:00.000Z'), 'Europe/Warsaw')).toBe('2026-06-01')
  })

  it('rejects an unknown zone', () => {
    expect(() => toZonedIsoDate(new Date('2026-06-01T12:00:00.000Z'), 'GMT+3')).toThrow(TypeError)
  })
})

describe('zonedWallTimeToInstant', () => {
  it.each([
    ['2026-01-15', '13:00', 'Europe/Warsaw', '2026-01-15T12:00:00.000Z'],
    ['2026-07-15', '13:00', 'Europe/Warsaw', '2026-07-15T11:00:00.000Z'],
    ['2026-07-15', '13:00', 'Europe/Lisbon', '2026-07-15T12:00:00.000Z'],
    ['2026-07-15', '13:00', 'UTC', '2026-07-15T13:00:00.000Z'],
  ])('%s %s in %s is %s', (date, wallTime, zone, expected) => {
    expect(zonedWallTimeToInstant(date, wallTime, zone).toISOString()).toBe(expected)
  })

  it('shifts a wall time that spring skips forward by the gap', () => {
    expect(zonedWallTimeToInstant('2026-03-29', '02:30', 'Europe/Warsaw').toISOString()).toBe(
      '2026-03-29T01:30:00.000Z'
    )
  })

  it('takes the first occurrence of a wall time that autumn repeats', () => {
    expect(zonedWallTimeToInstant('2026-10-25', '02:30', 'Europe/Warsaw').toISOString()).toBe(
      '2026-10-25T00:30:00.000Z'
    )
  })

  it.each(['24:00', '9:00', '12:60', '12:00:00'])('rejects the wall time %p', (wallTime) => {
    expect(() => zonedWallTimeToInstant('2026-07-15', wallTime, 'Europe/Warsaw')).toThrow(TypeError)
  })
})

describe('zonedDayStart', () => {
  it('starts a Warsaw summer day at 22:00 UTC the day before', () => {
    expect(zonedDayStart('2026-06-01', 'Europe/Warsaw').toISOString()).toBe('2026-05-31T22:00:00.000Z')
  })

  it('starts the day at 01:00 where the clock skips midnight', () => {
    expect(zonedDayStart('2026-09-06', 'America/Santiago').toISOString()).toBe('2026-09-06T04:00:00.000Z')
  })

  it('keeps a 23-hour and a 25-hour day one calendar day long', () => {
    const springDay = zonedDayStart('2026-03-30', 'Europe/Warsaw').getTime() - zonedDayStart('2026-03-29', 'Europe/Warsaw').getTime()
    const autumnDay = zonedDayStart('2026-10-26', 'Europe/Warsaw').getTime() - zonedDayStart('2026-10-25', 'Europe/Warsaw').getTime()

    expect(springDay).toBe(23 * 60 * 60 * 1000)
    expect(autumnDay).toBe(25 * 60 * 60 * 1000)
  })
})
