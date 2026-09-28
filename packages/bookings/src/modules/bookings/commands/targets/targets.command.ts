import type { EntityManager } from '@mikro-orm/postgresql'
import { nextPaletteColor } from '../../../../lib/timeline/palette'
import { Booking, BookingTarget, OPEN_BOOKING_STATUSES } from '../../data/entities'
import { bookingTargetCreateSchema, bookingTargetUpdateSchema } from '../../data/validators'
import type { BookingTargetCreateInput } from '../../data/validators'
import { bookingsErrors } from '../../lib/errors'
import { lockTarget } from '../../services/bookings/subject-lock'
import { requireBookingsSettings } from '../../services/settings/effective-settings'
import { registerScopedRecordCommands } from '../shared/scoped-record.commands'

export const BOOKING_TARGET_RESOURCE_KIND = 'bookings.target'

async function countOpenBookings(em: EntityManager, target: BookingTarget, placedOnly: boolean): Promise<number> {
  return em.count(Booking, {
    tenantId: target.tenantId,
    organizationId: target.organizationId,
    target: target.id,
    deletedAt: null,
    status: { $in: [...OPEN_BOOKING_STATUSES] },
    ...(placedOnly ? { startAt: { $ne: null } } : {}),
  })
}

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
  async beforeUpdate(em, target, values) {
    if (values.timeZone === undefined || values.timeZone === target.timeZone) return
    const placed = await countOpenBookings(em, target, true)
    if (placed > 0) throw bookingsErrors.targetZoneLocked(placed)
  },
  async beforeDelete(em, target) {
    await lockTarget(em, target.id)
    const openBookings = await countOpenBookings(em, target, false)
    if (openBookings > 0) throw bookingsErrors.targetInUse(openBookings)
  },
})
