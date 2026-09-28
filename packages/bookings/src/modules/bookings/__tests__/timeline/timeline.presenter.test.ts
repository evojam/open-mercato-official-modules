import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import { presentTimeline } from '../../components/timeline/timeline.presenter'
import type { TimelineBarDto, TimelineReadDto } from '../../services/timeline/timeline-read.service'

const t: TranslateFn = (key, fallbackOrParams, params) => {
  const fallback = typeof fallbackOrParams === 'string' ? fallbackOrParams : key
  const values = (typeof fallbackOrParams === 'object' ? fallbackOrParams : params) ?? {}
  return fallback.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
}

const deps = { t, formatDate: (date: string) => date.slice(5) }

const machines = { id: 'cat-1', name: 'Machines', icon: 'truck', color: '#2563eb' }

function bar(overrides: Partial<TimelineBarDto> = {}): TimelineBarDto {
  return {
    bookingId: 'b1',
    subjectId: 's1',
    targetId: 'target-1',
    targetName: 'Site A',
    targetColor: '#0ea5e9',
    status: 'planned',
    note: null,
    from: '2026-10-05',
    to: '2026-10-08',
    conflicts: [],
    ...overrides,
  }
}

function dto(overrides: Partial<TimelineReadDto> = {}): TimelineReadDto {
  return {
    range: { from: '2026-10-03', to: '2026-10-10' },
    today: '2026-10-05',
    wallClock: '2026-10-05T09:30:00',
    timeZone: 'Europe/Warsaw',
    calendar: { freeWeekdays: [6, 0], holidays: [] },
    rows: [
      { subjectId: 's1', name: 'Excavator', category: machines, isActive: true, providerKey: 'resources', cardHref: null, unavailabilityKnown: true },
      { subjectId: 's2', name: 'Anna', category: null, isActive: false, providerKey: 'staff', cardHref: null, unavailabilityKnown: false },
    ],
    bars: [],
    unavailability: [],
    ...overrides,
  }
}

describe('presentTimeline', () => {
  it('gives each row the badge of its category and explains inactive or unknown rows', () => {
    const view = presentTimeline(dto(), deps)

    expect(view.rows).toEqual([
      { id: 's1', label: 'Excavator', title: 'Machines', color: '#2563eb', iconName: 'truck', inactive: false },
      {
        id: 's2',
        label: 'Anna',
        title: 'Inactive\nUnavailability unknown for this subject',
        color: null,
        iconName: null,
        inactive: true,
      },
    ])
    expect(view.window).toEqual({ from: '2026-10-03', to: '2026-10-10' })
    expect(view.wallClock).toBe('2026-10-05T09:30:00')
  })

  it('draws a conflicting bar in the conflict tone and names the other side in its title', () => {
    const view = presentTimeline(
      dto({
        bars: [
          bar({
            conflicts: [
              { kind: 'overlap', subjectId: 's1', bookingId: 'b1', withBookingId: 'b2', withTargetName: 'Site B', from: '2026-10-06', to: '2026-10-08' },
              { kind: 'unavailability', subjectId: 's1', bookingId: 'b1', withWindowId: 'w1', reasonLabel: 'Service', from: '2026-10-07', to: '2026-10-08' },
            ],
          }),
        ],
        unavailability: [{ windowId: 'w1', subjectId: 's1', from: '2026-10-07', to: '2026-10-09', reason: 'Service' }],
      }),
      deps
    )

    expect(view.bars).toEqual([
      {
        id: 'b1:s1',
        rowId: 's1',
        from: '2026-10-05',
        to: '2026-10-08',
        label: 'Site A',
        title: 'Site A · 10-05 – 10-07\nplanned\nOverlaps Site B (10-06 – 10-07)\nUnavailable: Service (10-07)',
        color: '#0ea5e9',
        tone: 'conflict',
      },
    ])
    expect(view.unavailability).toEqual([
      { id: 'w1', rowId: 's1', from: '2026-10-07', to: '2026-10-09', label: 'Service', conflict: true },
    ])
  })

  it('shows a closed booking as done, even when it still overlaps something', () => {
    const view = presentTimeline(
      dto({
        bars: [
          bar({
            status: 'completed',
            conflicts: [{ kind: 'unavailability', subjectId: 's1', bookingId: 'b1', withWindowId: 'w1', from: '2026-10-07', to: '2026-10-08' }],
          }),
        ],
        unavailability: [{ windowId: 'w1', subjectId: 's1', from: '2026-10-07', to: '2026-10-09', reason: null }],
      }),
      deps
    )

    expect(view.bars[0].tone).toBe('done')
    expect(view.unavailability[0]).toMatchObject({ label: 'Unavailable', conflict: false })
  })
})
