import { isDirty, planBookingSave, windowOf } from '../../components/bookings/booking-dialog.presenter'
import type { BookingFormOrigin, BookingFormValues } from '../../components/bookings/booking-dialog.presenter'

const origin: BookingFormOrigin = {
  targetId: 'target-a',
  subjectId: 'subject-a',
  startOn: '2026-10-05',
  durationValue: '3',
  expectedStartOn: '2026-10-05',
  note: 'first note',
  placed: true,
  participantCount: 1,
}

const values = (overrides: Partial<BookingFormValues> = {}): BookingFormValues => ({ ...origin, ...overrides })

describe('planBookingSave', () => {
  it('sends nothing when nothing changed, whitespace included', () => {
    expect(planBookingSave(origin, values({ note: '  first note ' }))).toEqual([])
  })

  it('groups target, subject, expected start and note into one update step', () => {
    const steps = planBookingSave(origin, values({ targetId: 'target-b', subjectId: 'subject-b', expectedStartOn: '2026-10-09', note: '' }))

    expect(steps).toEqual([
      { kind: 'update', body: { targetId: 'target-b', subjectIds: ['subject-b'], expectedStartOn: '2026-10-09', note: null } },
    ])
  })

  it('orders the steps update → move → resize', () => {
    const steps = planBookingSave(origin, values({ note: 'later', startOn: '2026-10-12', durationValue: '2.5' }))

    expect(steps.map((step) => step.kind)).toEqual(['update', 'move', 'resize'])
    expect(steps[1]).toEqual({ kind: 'move', body: { startOn: '2026-10-12' } })
    expect(steps[2]).toEqual({ kind: 'resize', body: { durationValue: 2.5 } })
  })

  it('places instead of moving when the booking had no start yet', () => {
    const unplaced = { ...origin, startOn: '', placed: false }

    expect(planBookingSave(unplaced, values({ startOn: '2026-10-07' }))).toEqual([{ kind: 'place', body: { startOn: '2026-10-07' } }])
  })

  it('never unplaces and never touches the participants of a multi-participant booking', () => {
    expect(planBookingSave(origin, values({ startOn: '' }))).toEqual([])
    expect(planBookingSave({ ...origin, participantCount: 2 }, values({ subjectId: 'subject-b' }))).toEqual([])
  })

  it('treats "3" and "3.0" as the same length', () => {
    expect(planBookingSave(origin, values({ durationValue: '3.0' }))).toEqual([])
  })
})

describe('isDirty', () => {
  it('ignores surrounding whitespace but sees every field', () => {
    expect(isDirty(origin, values({ note: ' first note ' }))).toBe(false)
    expect(isDirty(origin, values({ durationValue: '4' }))).toBe(true)
    expect(isDirty(origin, values({ startOn: '' }))).toBe(true)
  })
})

describe('windowOf', () => {
  const calendar = { freeWeekdays: [6, 0], holidays: [] as string[] }

  it('gives the exclusive end after the working days', () => {
    expect(windowOf('2026-10-09', '3', calendar)).toEqual({ from: '2026-10-09', to: '2026-10-14' })
  })

  it('answers null while the fields are not complete', () => {
    expect(windowOf('', '3', calendar)).toBeNull()
    expect(windowOf('2026-10-09', '', calendar)).toBeNull()
    expect(windowOf('2026-10-09', '0', calendar)).toBeNull()
    expect(windowOf('2026-10-0', '1', calendar)).toBeNull()
  })
})
