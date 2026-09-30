import { bookingCardActions } from '../../lib/booking-card'

describe('bookingCardActions', () => {
  it('offers pencil, trash and finish on an open booking', () => {
    expect(bookingCardActions({ status: 'active', hasConflict: false, canAct: true })).toEqual({
      canEditInline: true,
      canCancel: true,
      footer: 'finish',
    })
  })

  it('trades the pencil and finish for a full-width edit button when the booking clashes', () => {
    expect(bookingCardActions({ status: 'planned', hasConflict: true, canAct: true })).toEqual({
      canEditInline: false,
      canCancel: true,
      footer: 'edit',
    })
  })

  it('offers only reopen on a completed or no-show booking, even while a conflict is recorded', () => {
    for (const status of ['completed', 'no_show'] as const) {
      expect(bookingCardActions({ status, hasConflict: true, canAct: true })).toEqual({
        canEditInline: false,
        canCancel: false,
        footer: 'reopen',
      })
    }
  })

  it('offers nothing on a cancelled booking', () => {
    expect(bookingCardActions({ status: 'cancelled', hasConflict: false, canAct: true }).footer).toBe('none')
  })

  it('offers nothing to a viewer', () => {
    expect(bookingCardActions({ status: 'planned', hasConflict: false, canAct: false })).toEqual({
      canEditInline: false,
      canCancel: false,
      footer: 'none',
    })
  })
})
