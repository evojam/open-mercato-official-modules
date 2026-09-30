'use client'

import * as React from 'react'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { BookingStatus } from '../../../../lib/pure-engine'
import type { BookingWriteResult } from '../../commands/shared/booking-write.commands'
import { BOOKINGS_API_PATHS } from '../../lib/api-paths'

export type BookingStatusErrorBody = {
  error?: string
  code?: string
  details?: unknown
}

export type BookingStatusChange = { ok: true } | { ok: false; body: BookingStatusErrorBody | null }

export function useBookingStatusChange() {
  const t = useT()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  const changeStatus = React.useCallback(
    async (bookingId: string, next: BookingStatus): Promise<BookingStatusChange | null> => {
      if (next === 'cancelled') {
        const cancel = await confirm({
          title: t('bookings.bookings.form.cancelTitle', 'Cancel this booking?'),
          text: t('bookings.bookings.form.cancelText', 'The subject becomes free on these days. You can undo it afterwards.'),
          confirmText: t('bookings.bookings.form.cancelConfirm', 'Cancel booking'),
          variant: 'destructive',
        })
        if (!cancel) return null
      }
      const call = await apiCall<BookingWriteResult | BookingStatusErrorBody>(BOOKINGS_API_PATHS.bookingActions.status, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId, tenantId, id: bookingId, status: next }),
      })
      if (!call.ok || !call.result) return { ok: false, body: call.result as BookingStatusErrorBody | null }
      const result = call.result as BookingWriteResult
      flash(
        t('bookings.bookings.messages.statusChanged', 'Status changed to {status}.', {
          status: t(`bookings.bookings.status.${next}`, next),
        }),
        'success'
      )
      if (result.conflicts.length > 0) {
        flash(
          t('bookings.bookings.messages.savedWithConflicts', 'Saved with {count} conflicts — check the red bars.', {
            count: result.conflicts.length,
          }),
          'warning'
        )
      }
      return { ok: true }
    },
    [confirm, organizationId, tenantId, t]
  )

  return { changeStatus, ConfirmDialogElement }
}
