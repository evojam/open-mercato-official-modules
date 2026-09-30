'use client'

import * as React from 'react'
import { Check, Pencil, RotateCcw } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { bookingCardActions } from '../../../../lib/booking-card'
import type { BookingCardViewModel } from '../../../../lib/booking-card'
import type { BookingStatus } from '../../../../lib/pure-engine'
import { BookingCard } from './booking-card.component'

export type BookingDetailCardProps = {
  readonly bookingId: string
  readonly status: BookingStatus
  readonly hasConflict: boolean
  readonly vm: BookingCardViewModel
  readonly canAct: boolean
  readonly onEditBooking: (bookingId: string) => void
  readonly onCancelBooking: (bookingId: string) => void
  readonly onFinishBooking: (bookingId: string) => void
  readonly onReopenBooking: (bookingId: string) => void
}

const FOOTER_BUTTON_CLASS = 'inline-flex h-8.5 items-center justify-center gap-1.5 rounded-md text-sm font-medium shadow-xs'

export function BookingDetailCard({
  bookingId,
  status,
  hasConflict,
  vm,
  canAct,
  onEditBooking,
  onCancelBooking,
  onFinishBooking,
  onReopenBooking,
}: BookingDetailCardProps) {
  const t = useT()
  const actions = bookingCardActions({ status, hasConflict, canAct })

  const footer = (): React.ReactNode => {
    if (actions.footer === 'none') return null
    if (actions.footer === 'reopen') {
      return (
        <button
          type="button"
          onClick={() => onReopenBooking(bookingId)}
          className={`${FOOTER_BUTTON_CLASS} border bg-background hover:bg-accent`}
        >
          <RotateCcw className="size-3.5" /> {t('bookings.card.actions.reopen', 'Reopen')}
        </button>
      )
    }
    if (actions.footer === 'edit') {
      return (
        <button
          type="button"
          onClick={() => onEditBooking(bookingId)}
          className={`${FOOTER_BUTTON_CLASS} w-full bg-primary text-primary-foreground hover:bg-primary-hover`}
        >
          <Pencil className="size-3.5" /> {t('bookings.card.actions.editBooking', 'Edit booking')}
        </button>
      )
    }
    return (
      <button
        type="button"
        onClick={() => onFinishBooking(bookingId)}
        className={`${FOOTER_BUTTON_CLASS} bg-primary text-primary-foreground hover:bg-primary-hover`}
      >
        <Check className="size-3.5" /> {t('bookings.card.actions.finish', 'Finish')}
      </button>
    )
  }

  return (
    <BookingCard
      vm={vm}
      editLabel={t('bookings.card.actions.edit', 'Edit')}
      deleteLabel={t('bookings.card.actions.cancel', 'Cancel booking')}
      onEdit={actions.canEditInline ? () => onEditBooking(bookingId) : undefined}
      onDelete={actions.canCancel ? () => onCancelBooking(bookingId) : undefined}
    >
      {footer()}
    </BookingCard>
  )
}
