import { countWorkingDays } from '../pure-engine'
import type { BookingStatus, WorkingCalendar } from '../pure-engine'
import { lastDayOf } from '../timeline/layout/range'
import type { DayRange, IsoDate } from '../time/types'
import type { BookingCardBadge, BookingCardRow, BookingCardViewModel } from './booking-card.view-model'

type Translate = (key: string, fallback: string, params?: Record<string, string | number>) => string

export type BookingCardDeps = {
  readonly t: Translate
  readonly locale: string
  readonly formatDate: (date: IsoDate) => string
  readonly calendar: WorkingCalendar
}

export type BookingCardInput = {
  readonly id: string
  readonly status: BookingStatus
  readonly days: DayRange | null
  readonly durationValue: number
  readonly expectedStartOn: IsoDate
  readonly note: string | null
  readonly targetName: string
  readonly targetColor: string | null
  readonly hasConflict: boolean
}

const PLURAL_FALLBACKS = {
  days: { one: '{count} day', other: '{count} days' },
  overrun: { one: 'Starts {count} working day late', other: 'Starts {count} working days late' },
} as const

function plural(kind: keyof typeof PLURAL_FALLBACKS, count: number, deps: BookingCardDeps): string {
  const category = new Intl.PluralRules(deps.locale).select(count)
  const fallback = category === 'one' ? PLURAL_FALLBACKS[kind].one : PLURAL_FALLBACKS[kind].other
  return deps.t(`bookings.card.${kind}.${category}`, fallback, { count })
}

function dayRange(days: DayRange, formatDate: BookingCardDeps['formatDate']): string {
  const last = lastDayOf(days)
  return last === days.from ? formatDate(days.from) : `${formatDate(days.from)} – ${formatDate(last)}`
}

export function unplacedTerm(params: {
  readonly durationValue: number
  readonly expectedStartOn: IsoDate
  readonly deps: BookingCardDeps
}): string {
  const { durationValue, expectedStartOn, deps } = params
  return deps.t('bookings.card.termUnplaced', '{days} · by {latest}', {
    days: plural('days', durationValue, deps),
    latest: deps.formatDate(expectedStartOn),
  })
}

function overrunBadge(startOn: IsoDate, expectedStartOn: IsoDate, deps: BookingCardDeps): BookingCardBadge | null {
  if (startOn <= expectedStartOn) return null
  const days = countWorkingDays(expectedStartOn, startOn, deps.calendar)
  if (days <= 0) return null
  return { tone: 'warning', label: plural('overrun', days, deps) }
}

export function presentBookingCard(params: {
  readonly booking: BookingCardInput
  readonly subjectName: string
  readonly subjectSubtitle?: string
  readonly subjectColor?: string | null
  readonly subjectIconName?: string | null
  readonly variant?: 'full' | 'compact'
  readonly priorityLabel?: string | null
  readonly extraRows?: readonly BookingCardRow[]
  readonly deps: BookingCardDeps
}): BookingCardViewModel {
  const { booking, subjectName, subjectSubtitle, deps } = params
  const compact = params.variant === 'compact'
  const { t } = deps

  const rows: BookingCardRow[] = []
  let term: string
  let badge: BookingCardBadge | null = null

  if (booking.days) {
    term = dayRange(booking.days, deps.formatDate)
    badge = overrunBadge(booking.days.from, booking.expectedStartOn, deps)
  } else {
    term = unplacedTerm({ durationValue: booking.durationValue, expectedStartOn: booking.expectedStartOn, deps })
  }

  if (!compact) {
    rows.push({
      label: t('bookings.card.expectedStart', 'Expected start'),
      value: deps.formatDate(booking.expectedStartOn),
    })
    rows.push({
      label: t('bookings.card.duration', 'Duration'),
      value: plural('days', booking.durationValue, deps),
    })
    rows.push({
      label: t('bookings.card.status', 'Status'),
      value: t(`bookings.bookings.status.${booking.status}`, booking.status),
    })
    rows.push(...(params.extraRows ?? []))
  }

  return {
    id: booking.id,
    tone: booking.hasConflict ? 'danger' : 'default',
    accentColor: params.subjectColor ?? null,
    iconName: params.subjectIconName ?? null,
    title: subjectName,
    subtitle: compact ? null : (subjectSubtitle ?? null),
    problemLabel: null,
    relation: { label: booking.targetName, color: booking.targetColor },
    priorityLabel: params.priorityLabel ?? null,
    term,
    badge,
    note: booking.note && booking.note.trim() ? booking.note : null,
    rows,
  }
}
