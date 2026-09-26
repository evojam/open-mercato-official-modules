import { nextPaletteColor } from '../../../../lib/timeline/palette'
import { Booking, BookingTarget, OPEN_BOOKING_STATUSES } from '../../data/entities'
import { bookingTargetCreateSchema, bookingTargetUpdateSchema } from '../../data/validators'
import type { BookingTargetCreateInput } from '../../data/validators'
import { bookingsErrors } from '../../lib/errors'
import { requireBookingsSettings } from '../../services/settings/effective-settings'
import { registerScopedRecordCommands } from '../shared/scoped-record.commands'

export const BOOKING_TARGET_RESOURCE_KIND = 'bookings.target'

export const bookingTargetCommands = registerScopedRecordCommands<BookingTarget, BookingTargetCreateInput>({
  commandPrefix: 'bookings.targets',
  resourceKind: BOOKING_TARGET_RESOURCE_KIND,
  entity: BookingTarget,
  fields: ['name', 'timeZone', 'color'],
  createSchema: bookingTargetCreateSchema,
  updateSchema: bookingTargetUpdateSchema,
  labels: {
    create: ['bookings.audit.targets.create', 'Create target'],
    update: ['bookings.audit.targets.update', 'Update target'],
    delete: ['bookings.audit.targets.delete', 'Delete target'],
  },
  errors: {
    notFound: 'bookings.targets.errors.notFound',
    duplicate: { error: 'bookings.targets.errors.duplicate', code: 'target_conflict' },
  },
  async valuesForCreate(em, input) {
    const scope = { tenantId: input.tenantId, organizationId: input.organizationId }
    const settings = await requireBookingsSettings(em, scope)
    const siblings = await em.find(BookingTarget, { ...scope, deletedAt: null }, { fields: ['color'] })
    return {
      name: input.name,
      timeZone: input.timeZone ?? settings.timeZone,
      color: input.color ?? nextPaletteColor(siblings.map((target) => target.color)),
    }
  },
  async beforeDelete(em, target) {
    const openBookings = await em.count(Booking, {
      tenantId: target.tenantId,
      organizationId: target.organizationId,
      target: target.id,
      deletedAt: null,
      status: { $in: [...OPEN_BOOKING_STATUSES] },
    })
    if (openBookings > 0) throw bookingsErrors.targetInUse(openBookings)
  },
})
