import {
  DEFAULT_TIMELINE_DAYS,
  MAX_TIMELINE_DAYS,
  daysIn,
  defaultTimelineRange,
  freeDaysIn,
  isSameRange,
  isTimelineRangeAllowed,
  lastDayOf,
  rangeThrough,
} from '../../lib/timeline/layout/range'

const weekends = { freeWeekdays: [6, 0] as const, holidays: [] }

describe('defaultTimelineRange', () => {
  it('opens two days before today and shows a week', () => {
    expect(defaultTimelineRange('2026-09-28')).toEqual({ from: '2026-09-26', to: '2026-10-03' })
    expect(DEFAULT_TIMELINE_DAYS).toBe(7)
  })
})

describe('isTimelineRangeAllowed', () => {
  it('accepts a range of one day up to the cap', () => {
    expect(isTimelineRangeAllowed({ from: '2026-09-28', to: '2026-09-29' })).toBe(true)
    expect(MAX_TIMELINE_DAYS).toBe(366)
    expect(isTimelineRangeAllowed({ from: '2026-01-01', to: '2027-01-02' })).toBe(true)
  })

  it('rejects an empty, reversed, too long or malformed range', () => {
    expect(isTimelineRangeAllowed({ from: '2026-09-28', to: '2026-09-28' })).toBe(false)
    expect(isTimelineRangeAllowed({ from: '2026-09-29', to: '2026-09-28' })).toBe(false)
    expect(isTimelineRangeAllowed({ from: '2026-01-01', to: '2027-01-03' })).toBe(false)
    expect(isTimelineRangeAllowed({ from: '2026-9-1', to: '2026-10-01' })).toBe(false)
  })
})

describe('picked ranges', () => {
  it('turns a first and a last day into a range with an exclusive end and back', () => {
    const range = rangeThrough('2026-09-26', '2026-09-30')
    expect(range).toEqual({ from: '2026-09-26', to: '2026-10-01' })
    expect(lastDayOf(range)).toBe('2026-09-30')
    expect(isSameRange(range, { from: '2026-09-26', to: '2026-10-01' })).toBe(true)
    expect(isSameRange(range, { from: '2026-09-26', to: '2026-10-02' })).toBe(false)
  })

  it('lists every day of a range', () => {
    expect(daysIn({ from: '2026-09-30', to: '2026-10-02' })).toEqual(['2026-09-30', '2026-10-01'])
    expect(daysIn({ from: '2026-10-02', to: '2026-10-02' })).toEqual([])
  })
})

describe('freeDaysIn', () => {
  it('names free weekdays and holidays, a holiday winning over a weekend', () => {
    const calendar = { ...weekends, holidays: ['2026-10-01', '2026-10-03'] }
    expect(freeDaysIn({ from: '2026-09-26', to: '2026-10-05' }, calendar)).toEqual([
      { date: '2026-09-26', kind: 'weekend' },
      { date: '2026-09-27', kind: 'weekend' },
      { date: '2026-10-01', kind: 'holiday' },
      { date: '2026-10-03', kind: 'holiday' },
      { date: '2026-10-04', kind: 'weekend' },
    ])
  })

  it('returns nothing for a calendar with no free days', () => {
    expect(freeDaysIn({ from: '2026-09-26', to: '2026-10-04' }, { freeWeekdays: [], holidays: [] })).toEqual([])
  })
})
