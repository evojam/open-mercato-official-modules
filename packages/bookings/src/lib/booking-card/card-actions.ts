import { NEXT_BOOKING_STATUSES, isClosed } from '../pure-engine'
import type { BookingStatus } from '../pure-engine'

export type BookingCardFooter = 'finish' | 'reopen' | 'edit' | 'none'

export type BookingCardActions = {
  readonly canEditInline: boolean
  readonly canCancel: boolean
  readonly footer: BookingCardFooter
}

const READ_ONLY: BookingCardActions = {
  canEditInline: false,
  canCancel: false,
  footer: 'none',
}

export function bookingCardActions(params: {
  readonly status: BookingStatus
  readonly hasConflict: boolean
  readonly canAct: boolean
}): BookingCardActions {
  if (!params.canAct) return READ_ONLY
  if (isClosed(params.status)) {
    return NEXT_BOOKING_STATUSES[params.status].length > 0 ? { ...READ_ONLY, footer: 'reopen' } : READ_ONLY
  }
  if (params.hasConflict) return { canEditInline: false, canCancel: true, footer: 'edit' }
  return { canEditInline: true, canCancel: true, footer: 'finish' }
}
