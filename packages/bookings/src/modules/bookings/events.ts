import { createModuleEvents } from '@open-mercato/shared/modules/events'
import type { BookingStatus } from '../../lib/pure-engine'

const events = [
  { id: 'bookings.booking.created', label: 'Booking Created', entity: 'booking', category: 'crud', clientBroadcast: true },
  { id: 'bookings.booking.updated', label: 'Booking Updated', entity: 'booking', category: 'crud', clientBroadcast: true },
  { id: 'bookings.booking.deleted', label: 'Booking Deleted', entity: 'booking', category: 'crud', clientBroadcast: true },
  { id: 'bookings.booking.placed', label: 'Booking Placed', entity: 'booking', category: 'lifecycle', clientBroadcast: true },
  { id: 'bookings.booking.moved', label: 'Booking Moved', entity: 'booking', category: 'lifecycle', clientBroadcast: true },
  { id: 'bookings.booking.resized', label: 'Booking Resized', entity: 'booking', category: 'lifecycle', clientBroadcast: true },
  { id: 'bookings.booking.cancelled', label: 'Booking Cancelled', entity: 'booking', category: 'lifecycle', clientBroadcast: true },
  { id: 'bookings.conflict.detected', label: 'Booking Conflict Detected', entity: 'conflict', category: 'system' },
  { id: 'bookings.coverage_gap.detected', label: 'Coverage Gap Detected', entity: 'coverage_gap', category: 'system' },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'bookings',
  events,
})

export const emitBookingsEvent = eventsConfig.emit

export type BookingsEventId = (typeof events)[number]['id']

export type BookingEventPayload = {
  id: string
  tenantId: string
  organizationId: string
  targetId: string
  subjectIds: string[]
  status: BookingStatus
  previousStatus: BookingStatus | null
  conflicts: number
}

export default eventsConfig
