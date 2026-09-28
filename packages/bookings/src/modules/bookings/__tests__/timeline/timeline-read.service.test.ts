import type { BookingParticipant, BookingSubject } from '../../data/entities'
import { assembleTimeline, readTimeline } from '../../services/timeline/timeline-read.service'
import { resolveEffectiveBookingsSettings } from '../../services/settings/effective-settings'
import type { TimelineSources, TimelineUnavailabilityDto } from '../../services/timeline/timeline-read.service'

jest.mock('../../services/settings/effective-settings', () => ({ resolveEffectiveBookingsSettings: jest.fn() }))

const machines = { id: 'cat-machines', name: 'Machines', color: '#2563eb' }
const people = { id: 'cat-people', name: 'People', color: null }

function subject(id: string, name: string, extra: Partial<BookingSubject> = {}): BookingSubject {
  return {
    id,
    name,
    providerKey: 'resources',
    providerRecordId: `rec-${id}`,
    timeZone: 'Europe/Warsaw',
    isActive: true,
    category: machines,
    ...extra,
  } as unknown as BookingSubject
}

const warsawSite = { id: 'target-1', name: 'Site A', timeZone: 'Europe/Warsaw', color: '#0ea5e9' }

function participant(bookingId: string, subjectId: string, startAt: string, endAt: string, status = 'planned') {
  return {
    subject: { id: subjectId },
    booking: {
      id: bookingId,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      status,
      note: null,
      target: warsawSite,
    },
  } as unknown as BookingParticipant
}

function sources(overrides: Partial<TimelineSources> = {}): TimelineSources {
  return {
    range: { from: '2026-10-05', to: '2026-10-12' },
    today: '2026-10-05',
    wallClock: '2026-10-05T09:30:00',
    timeZone: 'Europe/Warsaw',
    calendar: { freeWeekdays: [6, 0], holidays: [] },
    subjects: [],
    participants: [],
    unavailability: { windows: [], unknownSubjectIds: new Set() },
    query: {},
    ...overrides,
  }
}

const monToWed = ['2026-10-04T22:00:00.000Z', '2026-10-07T22:00:00.000Z'] as const
const tueToThu = ['2026-10-05T22:00:00.000Z', '2026-10-08T22:00:00.000Z'] as const

describe('assembleTimeline', () => {
  it('turns bookings into bars on the target days and marks both sides of an overlap', () => {
    const view = assembleTimeline(
      sources({
        subjects: [subject('s1', 'Excavator')],
        participants: [participant('b1', 's1', ...monToWed), participant('b2', 's1', ...tueToThu)],
      })
    )

    expect(view.bars.map((bar) => [bar.bookingId, bar.from, bar.to])).toEqual([
      ['b1', '2026-10-05', '2026-10-08'],
      ['b2', '2026-10-06', '2026-10-09'],
    ])
    expect(view.bars.map((bar) => bar.conflicts.map((conflict) => conflict.kind))).toEqual([['overlap'], ['overlap']])
    expect(view.bars[0].conflicts[0]).toMatchObject({ withBookingId: 'b2', withTargetName: 'Site A' })
  })

  it('reports a clash with unavailability and never counts a closed booking', () => {
    const window: TimelineUnavailabilityDto = {
      windowId: 'w1',
      subjectId: 's1',
      from: '2026-10-07',
      to: '2026-10-08',
      reason: 'Service',
    }
    const view = assembleTimeline(
      sources({
        subjects: [subject('s1', 'Excavator')],
        participants: [participant('b1', 's1', ...monToWed), participant('b2', 's1', ...tueToThu, 'completed')],
        unavailability: { windows: [window], unknownSubjectIds: new Set() },
      })
    )

    const [open, closed] = view.bars
    expect(open.conflicts).toEqual([expect.objectContaining({ kind: 'unavailability', withWindowId: 'w1', reasonLabel: 'Service' })])
    expect(closed.conflicts).toEqual([])
    expect(view.unavailability).toEqual([window])
  })

  it('sorts rows by category name, uncategorised last, and carries the category look on each row', () => {
    const view = assembleTimeline(
      sources({
        subjects: [
          subject('s3', 'Zoe', { category: null }),
          subject('s2', 'Anna', { category: people } as Partial<BookingSubject>),
          subject('s1', 'Crane'),
        ],
      })
    )

    expect(view.rows.map((row) => row.name)).toEqual(['Crane', 'Anna', 'Zoe'])
    expect(view.rows.map((row) => row.category)).toEqual([
      { id: 'cat-machines', name: 'Machines', icon: null, color: '#2563eb' },
      { id: 'cat-people', name: 'People', icon: null, color: null },
      null,
    ])
  })

  it('shows an inactive subject only while it still has a bar in the range', () => {
    const view = assembleTimeline(
      sources({
        subjects: [subject('s1', 'Old crane', { isActive: false }), subject('s2', 'Retired', { isActive: false })],
        participants: [participant('b1', 's1', ...monToWed)],
      })
    )

    expect(view.rows.map((row) => [row.subjectId, row.isActive])).toEqual([['s1', false]])
  })

  it('keeps only rows with a conflict, or drops rows with unavailability, on request', () => {
    const subjects = [subject('s1', 'A'), subject('s2', 'B'), subject('s3', 'C')]
    const participants = [
      participant('b1', 's1', ...monToWed),
      participant('b2', 's1', ...tueToThu),
      participant('b3', 's2', ...monToWed),
    ]
    const unavailability = {
      windows: [{ windowId: 'w1', subjectId: 's3', from: '2026-10-09', to: '2026-10-10', reason: null }],
      unknownSubjectIds: new Set(['s2']),
    }

    const conflictsOnly = assembleTimeline(sources({ subjects, participants, unavailability, query: { conflictsOnly: true } }))
    const hideUnavailable = assembleTimeline(sources({ subjects, participants, unavailability, query: { hideUnavailable: true } }))

    expect(conflictsOnly.rows.map((row) => row.subjectId)).toEqual(['s1'])
    expect(conflictsOnly.bars.map((bar) => bar.bookingId)).toEqual(['b1', 'b2'])
    expect(hideUnavailable.rows.map((row) => [row.subjectId, row.unavailabilityKnown])).toEqual([
      ['s1', true],
      ['s2', false],
    ])
  })

  it('leaves out bars outside the range and sends the calendar with holidays of the range only', () => {
    const view = assembleTimeline(
      sources({
        subjects: [subject('s1', 'Excavator')],
        participants: [participant('b1', 's1', '2026-10-12T22:00:00.000Z', '2026-10-13T22:00:00.000Z')],
        calendar: { freeWeekdays: [6, 0], holidays: ['2026-10-01', '2026-10-07', '2026-10-12'] },
      })
    )

    expect(view.bars).toEqual([])
    expect(view.calendar).toEqual({ freeWeekdays: [6, 0], holidays: ['2026-10-07'] })
    expect(view.wallClock).toBe('2026-10-05T09:30:00')
  })
})

describe('readTimeline', () => {
  it('reads again over the span of the bars, so a clash with a booking outside the range still shows', async () => {
    jest.mocked(resolveEffectiveBookingsSettings).mockResolvedValue({
      calendar: { freeWeekdays: [6, 0], holidays: [] },
      warningThresholdWorkingDays: 5,
      conflictPolicy: 'advisory',
      conflictPolicyExceptions: [],
      timeZone: 'Europe/Warsaw',
    })
    const long = participant('b-long', 's1', '2026-09-30T22:00:00.000Z', '2026-10-09T22:00:00.000Z')
    const early = participant('b-early', 's1', '2026-10-01T22:00:00.000Z', '2026-10-02T22:00:00.000Z')
    const find = jest
      .fn()
      .mockResolvedValueOnce([subject('s1', 'Excavator')])
      .mockResolvedValueOnce([long])
      .mockResolvedValueOnce([long, early])
    const deps = { em: { find }, queryEngine: {} } as never

    const view = await readTimeline(
      deps,
      { tenantId: 't', organizationId: 'o' },
      { range: { from: '2026-10-08', to: '2026-10-15' } },
      new Date('2026-10-08T08:00:00.000Z')
    )

    expect(find).toHaveBeenCalledTimes(3)
    expect(find.mock.calls[2][1].booking.startAt.$lt).toEqual(new Date('2026-10-15T14:00:00.000Z'))
    expect(find.mock.calls[2][1].booking.endAt.$gt).toEqual(new Date('2026-09-30T22:00:00.000Z'))
    expect(view.bars.map((bar) => [bar.bookingId, bar.conflicts.map((conflict) => conflict.kind)])).toEqual([
      ['b-long', ['overlap']],
    ])
  })
})
