import { Check, Entity, Enum, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { BookingTarget } from '../targets/target.entity'
import { BOOKING_STATUSES, type BookingStatus } from '../../../../../lib/pure-engine/status.rule'

export const BOOKING_DURATION_UNITS = ['working_days', 'minutes'] as const

export type BookingDurationUnit = (typeof BOOKING_DURATION_UNITS)[number]

@Entity({ tableName: 'bookings_bookings' })
@Index({
  name: 'bookings_bookings_org_tenant_deleted_idx',
  properties: ['organizationId', 'tenantId', 'deletedAt'],
})
@Index({
  name: 'bookings_bookings_open_window_idx',
  expression:
    `create index "bookings_bookings_open_window_idx" on "bookings_bookings" ("organization_id", "start_at", "end_at") where "deleted_at" is null and "status" in ('planned', 'active')`,
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
  name: 'bookings_bookings_duration_chk',
  expression:
    `"duration_value" > 0 and ("duration_unit" <> 'working_days' or ("duration_value" * 2) = floor("duration_value" * 2))`,
})
@Check({
  name: 'bookings_bookings_last_warned_chk',
  expression: `"last_warned_working_days" is null or "last_warned_working_days" >= 0`,
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

  @Enum({ name: 'status', items: () => BOOKING_STATUSES, type: 'text', default: 'planned' })
  status: BookingStatus = 'planned'

  @Property({ name: 'duration_value', type: 'numeric', precision: 8, scale: 2 })
  durationValue!: string

  @Enum({
    name: 'duration_unit',
    items: () => BOOKING_DURATION_UNITS,
    type: 'text',
    default: 'working_days',
  })
  durationUnit: BookingDurationUnit = 'working_days'

  @Property({ name: 'expected_start_on', type: 'date' })
  expectedStartOn!: string

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
