'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { isClosed } from '../../../../lib/pure-engine'
import { problemLabel } from '../../../../lib/booking-card'
import { BookingDetailCard } from './booking-detail-card.component'
import { BookingDetailRail } from './booking-detail-rail.component'
import type { BookingDetailEntry, BookingDetailSelection } from './booking-detail.presenter'

export type BookingDetailPanelProps = {
  readonly selection: BookingDetailSelection
  readonly canWrite: boolean
  readonly actionsLocked?: boolean
  readonly onClose: () => void
  readonly onEditBooking: (bookingId: string) => void
  readonly onCancelBooking: (bookingId: string) => void
  readonly onFinishBooking: (bookingId: string) => void
  readonly onReopenBooking: (bookingId: string) => void
}

export function BookingDetailPanel({
  selection,
  canWrite,
  actionsLocked = false,
  onClose,
  onEditBooking,
  onCancelBooking,
  onFinishBooking,
  onReopenBooking,
}: BookingDetailPanelProps) {
  const t = useT()
  const closed = isClosed(selection.primary.status)
  const canAct = canWrite && !actionsLocked

  const kicker = (): string => {
    if (closed) return t('bookings.card.kicker.closed', 'Booking — closed')
    if (selection.problem) return problemLabel(selection.problem, t)
    return t('bookings.card.kicker.booking', 'Booking')
  }

  const cardOf = (entry: BookingDetailEntry) => (
    <BookingDetailCard
      key={entry.bookingId}
      bookingId={entry.bookingId}
      status={entry.status}
      hasConflict={entry.hasConflict}
      vm={entry.vm}
      canAct={canAct}
      onEditBooking={onEditBooking}
      onCancelBooking={onCancelBooking}
      onFinishBooking={onFinishBooking}
      onReopenBooking={onReopenBooking}
    />
  )

  return (
    <BookingDetailRail
      title={t('bookings.card.title', 'Details')}
      closeLabel={t('bookings.card.close', 'Close')}
      closeTitle={t('bookings.card.closeHint', 'Close the panel — the booking stays as it is')}
      readOnlyLabel={canWrite ? null : t('bookings.card.readOnly', 'Read only')}
      kicker={kicker()}
      onClose={onClose}
    >
      {closed ? (
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-status-success-bg px-2.5 py-0.5 text-xs font-semibold text-status-success-text">
          <Check className="size-3.25" /> {t(`bookings.bookings.status.${selection.primary.status}`, selection.primary.status)}
        </span>
      ) : null}
      {cardOf(selection.primary)}
      {selection.partners.length > 0 ? (
        <>
          <span className="text-overline font-semibold uppercase tracking-wider text-muted-foreground">
            {t('bookings.card.clashesWith', 'Clashes with')}
          </span>
          {selection.partners.map(cardOf)}
        </>
      ) : null}
    </BookingDetailRail>
  )
}
