import { addWorkingDays, countWorkingDays, isWorkingDay } from '../../lib/pure-engine'
import type { WorkingCalendar } from '../../lib/pure-engine'

const WEEKENDS_FREE: WorkingCalendar = { freeWeekdays: [6, 0], holidays: [] }
const WITH_HOLIDAY: WorkingCalendar = { freeWeekdays: [6, 0], holidays: ['2026-11-11'] }
const NO_FREE_DAYS: WorkingCalendar = { freeWeekdays: [], holidays: [] }
const ALL_FREE: WorkingCalendar = { freeWeekdays: [0, 1, 2, 3, 4, 5, 6], holidays: [] }

describe('isWorkingDay', () => {
  it.each([
    ['2026-09-25', WEEKENDS_FREE, true],
    ['2026-09-26', WEEKENDS_FREE, false],
    ['2026-09-27', WEEKENDS_FREE, false],
    ['2026-11-11', WITH_HOLIDAY, false],
    ['2026-09-26', NO_FREE_DAYS, true],
  ])('%s is a working day: %s', (date, calendar, expected) => {
    expect(isWorkingDay(date, calendar)).toBe(expected)
  })
})

describe('addWorkingDays', () => {
  it('ends the day after the last working day', () => {
    expect(addWorkingDays('2026-09-28', 5, WEEKENDS_FREE)).toBe('2026-10-03')
  })

  it('stretches over a weekend in the middle', () => {
    expect(addWorkingDays('2026-09-24', 5, WEEKENDS_FREE)).toBe('2026-10-01')
  })

  it('stretches over a holiday', () => {
    expect(addWorkingDays('2026-11-10', 2, WITH_HOLIDAY)).toBe('2026-11-13')
  })

  it('takes one working day for a single day', () => {
    expect(addWorkingDays('2026-09-24', 1, WEEKENDS_FREE)).toBe('2026-09-25')
  })

  it('rounds half a day up to a whole day on the timeline', () => {
    expect(addWorkingDays('2026-09-28', 2.5, WEEKENDS_FREE)).toBe('2026-10-01')
    expect(addWorkingDays('2026-09-28', 0.5, WEEKENDS_FREE)).toBe('2026-09-29')
  })

  it('counts a free start day the dispatcher chose, then skips the free days after it', () => {
    expect(addWorkingDays('2026-09-26', 1, WEEKENDS_FREE)).toBe('2026-09-27')
    expect(addWorkingDays('2026-09-26', 3, WEEKENDS_FREE)).toBe('2026-09-30')
  })

  it('counts every day when the calendar has no free days', () => {
    expect(addWorkingDays('2026-09-26', 3, NO_FREE_DAYS)).toBe('2026-09-29')
  })

  it('crosses a year boundary', () => {
    expect(addWorkingDays('2026-12-31', 2, WEEKENDS_FREE)).toBe('2027-01-02')
  })

  it.each([0, -1, Number.NaN])('rejects the duration %p', (duration) => {
    expect(() => addWorkingDays('2026-09-28', duration, WEEKENDS_FREE)).toThrow(RangeError)
  })

  it('rejects a calendar with no working day instead of looping forever', () => {
    expect(() => addWorkingDays('2026-09-28', 2, ALL_FREE)).toThrow(RangeError)
  })

  it('still places a single day on a calendar with no working day', () => {
    expect(addWorkingDays('2026-09-28', 1, ALL_FREE)).toBe('2026-09-29')
  })
})

describe('countWorkingDays', () => {
  it('counts working days in a half-open range', () => {
    expect(countWorkingDays('2026-09-24', '2026-10-01', WEEKENDS_FREE)).toBe(5)
  })

  it('skips a holiday', () => {
    expect(countWorkingDays('2026-11-09', '2026-11-14', WITH_HOLIDAY)).toBe(4)
  })

  it('returns zero for an empty or reversed range', () => {
    expect(countWorkingDays('2026-09-24', '2026-09-24', WEEKENDS_FREE)).toBe(0)
    expect(countWorkingDays('2026-09-30', '2026-09-24', WEEKENDS_FREE)).toBe(0)
  })

  it('inverts addWorkingDays for a start on a working day', () => {
    const end = addWorkingDays('2026-09-24', 7, WITH_HOLIDAY)

    expect(countWorkingDays('2026-09-24', end, WITH_HOLIDAY)).toBe(7)
  })

  it('rejects a malformed end instead of looping forever', () => {
    expect(() => countWorkingDays('2026-09-24', 'later', WEEKENDS_FREE)).toThrow(TypeError)
  })
})
