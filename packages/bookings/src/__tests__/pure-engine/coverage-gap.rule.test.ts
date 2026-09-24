import { coverageGap } from '../../lib/pure-engine'
import type { CoverageGapInput, WorkingCalendar } from '../../lib/pure-engine'

const MONDAY = '2026-09-28'
const CALENDAR: WorkingCalendar = { freeWeekdays: [6, 0], holidays: [] }

function input(overrides: Partial<CoverageGapInput> = {}): CoverageGapInput {
  return {
    status: 'planned',
    isPlaced: false,
    expectedStartOn: '2026-10-01',
    today: MONDAY,
    calendar: CALENDAR,
    thresholdWorkingDays: 5,
    ...overrides,
  }
}

describe('coverageGap', () => {
  it('warns about an unplaced booking inside the threshold', () => {
    expect(coverageGap(input())).toEqual({ workingDaysLeft: 3, isOverdue: false })
  })

  it('warns exactly at the threshold and not one working day beyond', () => {
    expect(coverageGap(input({ expectedStartOn: '2026-10-05' }))).toEqual({ workingDaysLeft: 5, isOverdue: false })
    expect(coverageGap(input({ expectedStartOn: '2026-10-06' }))).toBeNull()
  })

  it('does not count a weekend or a holiday towards the days left', () => {
    const withHoliday: WorkingCalendar = { freeWeekdays: [6, 0], holidays: ['2026-09-30'] }

    expect(coverageGap(input({ expectedStartOn: '2026-10-06', calendar: withHoliday }))).toEqual({
      workingDaysLeft: 5,
      isOverdue: false,
    })
  })

  it('reports zero days left, not overdue, when the deadline is today', () => {
    expect(coverageGap(input({ expectedStartOn: MONDAY }))).toEqual({ workingDaysLeft: 0, isOverdue: false })
  })

  it('reports a passed deadline as overdue with the counter stopped at zero', () => {
    expect(coverageGap(input({ expectedStartOn: '2026-09-25', thresholdWorkingDays: 0 }))).toEqual({
      workingDaysLeft: 0,
      isOverdue: true,
    })
  })

  it('stays silent for a placed booking', () => {
    expect(coverageGap(input({ isPlaced: true, expectedStartOn: '2026-09-25' }))).toBeNull()
  })

  it.each(['completed', 'cancelled', 'no_show'] as const)('stays silent for a %s booking', (status) => {
    expect(coverageGap(input({ status, expectedStartOn: '2026-09-25' }))).toBeNull()
  })

  it('warns an active booking that lost its placement', () => {
    expect(coverageGap(input({ status: 'active' }))).toEqual({ workingDaysLeft: 3, isOverdue: false })
  })

  it('counts from the target-zone today it is given, so a day later means one day less', () => {
    expect(coverageGap(input({ today: '2026-09-29' }))).toEqual({ workingDaysLeft: 2, isOverdue: false })
  })

  it.each([-1, 1.5, Number.NaN])('rejects the threshold %p', (thresholdWorkingDays) => {
    expect(() => coverageGap(input({ thresholdWorkingDays }))).toThrow(RangeError)
  })
})
