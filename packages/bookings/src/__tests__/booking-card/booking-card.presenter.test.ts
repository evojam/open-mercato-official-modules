import { presentBookingCard } from '../../lib/booking-card'
import type { BookingCardDeps, BookingCardInput } from '../../lib/booking-card'

const t = (_key: string, fallback: string, params?: Record<string, string | number>): string =>
  Object.entries(params ?? {}).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), fallback)

const deps: BookingCardDeps = {
  t,
  locale: 'en',
  formatDate: (date) => date,
  calendar: { freeWeekdays: [6, 0], holidays: [] },
}

function placedBooking(overrides: Partial<BookingCardInput> = {}): BookingCardInput {
  return {
    id: 'booking-1',
    status: 'planned',
    days: { from: '2026-02-05', to: '2026-02-11' },
    durationValue: 4,
    expectedStartOn: '2026-02-05',
    note: 'Enter from Portowa street.',
    targetName: 'Bridge on the Vistula',
    targetColor: '#2A6FDB',
    hasConflict: false,
    ...overrides,
  }
}

describe('presentBookingCard', () => {
  it('shows a date range for a placed booking and colours the target', () => {
    const vm = presentBookingCard({
      booking: placedBooking(),
      subjectName: 'JCB excavator',
      subjectSubtitle: 'Excavators',
      deps,
    })

    expect(vm.term).toBe('2026-02-05 – 2026-02-10')
    expect(vm.title).toBe('JCB excavator')
    expect(vm.subtitle).toBe('Excavators')
    expect(vm.relation).toEqual({ label: 'Bridge on the Vistula', color: '#2A6FDB' })
    expect(vm.tone).toBe('default')
  })

  it('carries the subject appearance so the card badge is painted and iconed', () => {
    const vm = presentBookingCard({
      booking: placedBooking(),
      subjectName: 'JCB excavator',
      subjectColor: '#f59e0b',
      subjectIconName: 'truck',
      deps,
    })

    expect(vm.accentColor).toBe('#f59e0b')
    expect(vm.iconName).toBe('truck')
  })

  it('prepares the expected start, duration and status rows, then the consumer rows', () => {
    const vm = presentBookingCard({
      booking: placedBooking(),
      subjectName: 'JCB excavator',
      extraRows: [{ label: 'Side number', value: 'K-01' }],
      deps,
    })

    expect(vm.rows).toEqual([
      { label: 'Expected start', value: '2026-02-05' },
      { label: 'Duration', value: '4 days' },
      { label: 'Status', value: 'planned' },
      { label: 'Side number', value: 'K-01' },
    ])
  })

  it('states the days and the expected start when the booking is not on the timeline yet', () => {
    const vm = presentBookingCard({ booking: placedBooking({ days: null }), subjectName: 'JCB excavator', deps })

    expect(vm.term).toBe('4 days · by 2026-02-05')
    expect(vm.badge).toBeNull()
  })

  it('uses the singular day form for a one-day demand', () => {
    const vm = presentBookingCard({ booking: placedBooking({ days: null, durationValue: 1 }), subjectName: 'JCB excavator', deps })

    expect(vm.term).toBe('1 day · by 2026-02-05')
  })

  it('raises an amber badge counting working days when the start slipped past the expected start', () => {
    const vm = presentBookingCard({
      booking: placedBooking({ days: { from: '2026-02-10', to: '2026-02-14' } }),
      subjectName: 'JCB excavator',
      deps,
    })

    expect(vm.badge).toEqual({ tone: 'warning', label: 'Starts 3 working days late' })
  })

  it('leaves the badge empty when the booking starts on the expected day', () => {
    const vm = presentBookingCard({ booking: placedBooking(), subjectName: 'JCB excavator', deps })

    expect(vm.badge).toBeNull()
  })

  it('leaves the badge empty when only free days separate the expected and the real start (2026-02-07 is a Saturday)', () => {
    const vm = presentBookingCard({
      booking: placedBooking({ expectedStartOn: '2026-02-07', days: { from: '2026-02-09', to: '2026-02-11' } }),
      subjectName: 'JCB excavator',
      deps,
    })

    expect(vm.badge).toBeNull()
  })

  it('turns the card red once the engine flags a conflict', () => {
    const vm = presentBookingCard({ booking: placedBooking({ hasConflict: true }), subjectName: 'JCB excavator', deps })

    expect(vm.tone).toBe('danger')
  })

  it('hides an empty note instead of rendering a blank line', () => {
    const vm = presentBookingCard({ booking: placedBooking({ note: '   ' }), subjectName: 'JCB excavator', deps })

    expect(vm.note).toBeNull()
  })

  it('drops the rows and the subtitle in the compact variant', () => {
    const vm = presentBookingCard({
      booking: placedBooking(),
      subjectName: 'JCB excavator',
      subjectSubtitle: 'Excavators',
      variant: 'compact',
      extraRows: [{ label: 'Side number', value: 'K-01' }],
      deps,
    })

    expect(vm.rows).toEqual([])
    expect(vm.subtitle).toBeNull()
  })

  it('picks the plural form of the viewer language', () => {
    const keys: string[] = []
    const polish: BookingCardDeps = {
      ...deps,
      locale: 'pl',
      t: (key, fallback, params) => {
        keys.push(key)
        return t(key, fallback, params)
      },
    }

    presentBookingCard({ booking: placedBooking({ durationValue: 3 }), subjectName: 'JCB excavator', deps: polish })

    expect(keys).toContain('bookings.card.days.few')
  })
})
