'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { NEXT_BOOKING_STATUSES } from '../../../../lib/pure-engine'
import type { BookingStatus } from '../../../../lib/pure-engine'

export type BookingStatusControlProps = {
  status: BookingStatus
  disabled?: boolean
  onChange: (next: BookingStatus) => void
}

export function BookingStatusControl({ status, disabled, onChange }: BookingStatusControlProps) {
  const t = useT()
  const labelOf = (value: BookingStatus) => t(`bookings.bookings.status.${value}`, value)
  const options = NEXT_BOOKING_STATUSES[status]

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
      <div className="text-sm">
        <span className="text-muted-foreground">{t('bookings.bookings.form.status', 'Status')}: </span>
        <span className="font-medium">{labelOf(status)}</span>
      </div>
      <Select value="" onValueChange={(next) => onChange(next as BookingStatus)} disabled={disabled || options.length === 0}>
        <SelectTrigger className="h-9 w-auto min-w-44" aria-label={t('bookings.bookings.form.changeStatus', 'Change status…')}>
          <SelectValue placeholder={t('bookings.bookings.form.changeStatus', 'Change status…')} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {labelOf(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
