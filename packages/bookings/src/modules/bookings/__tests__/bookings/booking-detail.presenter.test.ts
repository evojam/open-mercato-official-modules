import type { BookingCardDeps } from '../../../../lib/booking-card'
import { selectBookingDetail } from '../../components/bookings/booking-detail.presenter'
import type { TimelineBarDto, TimelineReadDto } from '../../services/timeline/timeline-read.service'

const deps: BookingCardDeps = {
  t: (_key, fallback) => fallback,
  locale: 'en',
  formatDate: (date) => date,
  calendar: { freeWeekdays: [6, 0], holidays: [] },
}

function bar(bookingId: string, overrides: Partial<TimelineBarDto> = {}): TimelineBarDto {
  return {
    bookingId,
    subjectId: 's1',
    targetId: 't1',
    targetName: 'Bridge',
    targetColor: '#2563eb',
    status: 'planned',
    durationValue: 2,
    expectedStartOn: '2026-02-05',
    note: null,
    conflicts: [],
    from: '2026-02-05',
    to: '2026-02-07',
    ...overrides,
  }
}

function view(bars: TimelineBarDto[]): TimelineReadDto {
  return {
    range: { from: '2026-02-02', to: '2026-02-09' },
    today: '2026-02-03',
    wallClock: '08:00',
    timeZone: 'Europe/Warsaw',
    calendar: deps.calendar,
    rows: [
      {
        subjectId: 's1',
        name: 'Excavator',
        category: { id: 'c1', name: 'Machines', icon: 'truck', color: '#f59e0b' },
        isActive: true,
        providerKey: 'resources',
        cardHref: null,
        unavailabilityKnown: true,
      },
    ],
    bars,
    unavailability: [],
  }
}

describe('selectBookingDetail', () => {
  it('builds the card of the selected bar from its subject row', () => {
    const detail = selectBookingDetail(view([bar('b1')]), 'b1:s1', deps)

    expect(detail?.primary.vm).toMatchObject({
      title: 'Excavator',
      subtitle: 'Machines',
      accentColor: '#f59e0b',
      iconName: 'truck',
      relation: { label: 'Bridge', color: '#2563eb' },
    })
    expect(detail?.partners).toEqual([])
    expect(detail?.problem).toBeNull()
  })

  it('puts the clashing bookings of the same subject under the selected one and names the problem', () => {
    const clash = { kind: 'overlap' as const, subjectId: 's1', from: '2026-02-05', to: '2026-02-06' }
    const bars = [
      bar('b1', { conflicts: [{ ...clash, bookingId: 'b1', withBookingId: 'b2', withTargetId: 't2' }] }),
      bar('b2', { targetId: 't2', targetName: 'Tunnel', conflicts: [{ ...clash, bookingId: 'b2', withBookingId: 'b1', withTargetId: 't1' }] }),
      bar('b3', { from: '2026-02-09', to: '2026-02-10' }),
    ]

    const detail = selectBookingDetail(view(bars), 'b1:s1', deps)

    expect(detail?.primary.hasConflict).toBe(true)
    expect(detail?.partners.map((partner) => partner.bookingId)).toEqual(['b2'])
    expect(detail?.partners[0].vm.tone).toBe('danger')
    expect(detail?.problem).toBe('overlap_other_target')
  })

  it('shows nothing when no bar is selected or the selected bar left the range', () => {
    expect(selectBookingDetail(view([bar('b1')]), null, deps)).toBeNull()
    expect(selectBookingDetail(view([bar('b1')]), 'gone:s1', deps)).toBeNull()
  })
})
