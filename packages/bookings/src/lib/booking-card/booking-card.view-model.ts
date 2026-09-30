export type BookingCardTone = 'default' | 'danger'

export type BookingCardBadgeTone = 'warning' | 'danger'

export type BookingCardBadge = {
  readonly label: string
  readonly tone: BookingCardBadgeTone
}

export type BookingCardRelation = {
  readonly label: string
  readonly color: string | null
}

export type BookingCardRow = {
  readonly label: string
  readonly value: string
  readonly hint?: string
  readonly layout?: 'inline' | 'stacked'
}

export type BookingCardViewModel = {
  readonly id: string
  readonly tone: BookingCardTone
  readonly accentColor: string | null
  readonly iconName: string | null
  readonly title: string
  readonly subtitle: string | null
  readonly problemLabel: string | null
  readonly relation: BookingCardRelation | null
  readonly priorityLabel: string | null
  readonly term: string | null
  readonly badge: BookingCardBadge | null
  readonly note: string | null
  readonly rows: readonly BookingCardRow[]
}
