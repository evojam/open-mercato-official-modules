import { Check, Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { BookingTarget } from '../targets/target.entity'

export type BookingStatus = 'planned' | 'active' | 'completed' | 'cancelled' | 'no_show'

@Entity({ tableName: 'bookings_bookings' })
@Index({
  name: 'bookings_bookings_org_tenant_deleted_idx',
  properties: ['organizationId', 'tenantId', 'deletedAt'],
})
@Index({
  name: 'bookings_bookings_org_window_idx',
  properties: ['organizationId', 'startAt', 'endAt'],
})
@Index({
  name: 'bookings_bookings_org_expected_start_idx',
  properties: ['organizationId', 'expectedStartOn'],
})
@Index({
  name: 'bookings_bookings_target_idx',
  properties: ['target'],
})
@Check({
  name: 'bookings_bookings_window_pair_chk',
  expression: `("start_at" is null) = ("end_at" is null)`,
})
@Check({
  name: 'bookings_bookings_window_order_chk',
  expression: `"end_at" is null or "end_at" > "start_at"`,
})
@Check({
  name: 'bookings_bookings_duration_half_day_chk',
  expression: `"duration_working_days" > 0 and ("duration_working_days" * 2) = floor("duration_working_days" * 2)`,
})
export class Booking {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @ManyToOne(() => BookingTarget, { fieldName: 'target_id' })
  target!: BookingTarget

  @Property({ name: 'start_at', type: Date, nullable: true })
  startAt?: Date | null

  @Property({ name: 'end_at', type: Date, nullable: true })
  endAt?: Date | null

  @Property({ name: 'status', type: 'text', default: 'planned' })
  status: BookingStatus = 'planned'

  @Property({ name: 'duration_working_days', type: 'numeric', precision: 4, scale: 1 })
  durationWorkingDays!: string

  @Property({ name: 'expected_start_on', type: 'date' })
  expectedStartOn!: Date

  @Property({ name: 'last_warned_working_days', type: 'integer', nullable: true })
  lastWarnedWorkingDays?: number | null

  @Property({ name: 'note', type: 'text', nullable: true })
  note?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
