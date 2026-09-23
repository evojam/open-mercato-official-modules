import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { BookingSubject } from '../subjects/subject.entity'
import { Booking } from './booking.entity'

export const BOOKING_PARTICIPANT_ROLES = ['performer', 'place', 'supporting'] as const

export type BookingParticipantRole = (typeof BOOKING_PARTICIPANT_ROLES)[number]

@Entity({ tableName: 'bookings_participants' })
@Index({
  name: 'bookings_participants_org_tenant_deleted_idx',
  properties: ['organizationId', 'tenantId', 'deletedAt'],
})
@Index({
  name: 'bookings_participants_subject_idx',
  properties: ['subject'],
})
@Index({
  name: 'bookings_participants_booking_subject_uq',
  expression:
    `create unique index "bookings_participants_booking_subject_uq" on "bookings_participants" ("booking_id", "subject_id") where "deleted_at" is null`,
})
export class BookingParticipant {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @ManyToOne(() => Booking, { fieldName: 'booking_id' })
  booking!: Booking

  @ManyToOne(() => BookingSubject, { fieldName: 'subject_id' })
  subject!: BookingSubject

  @Enum({ name: 'role', items: () => BOOKING_PARTICIPANT_ROLES, type: 'text', default: 'performer' })
  role: BookingParticipantRole = 'performer'

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
