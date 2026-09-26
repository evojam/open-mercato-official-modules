import { OptionalProps } from '@mikro-orm/core'
import { Check, Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { BOOKING_CONFLICT_POLICIES } from '../../../lib/pure-engine/conflict-policy.rule'
import type { BookingConflictPolicy } from '../../../lib/pure-engine/conflict-policy.rule'
import { BOOKING_STATUSES, OPEN_BOOKING_STATUSES } from '../../../lib/pure-engine/status.rule'
import type { BookingStatus } from '../../../lib/pure-engine/status.rule'

export { BOOKING_CONFLICT_POLICIES, BOOKING_STATUSES, OPEN_BOOKING_STATUSES }
export type { BookingConflictPolicy, BookingStatus }

const OPEN_STATUSES_SQL = OPEN_BOOKING_STATUSES.map((status) => `'${status}'`).join(', ')

export const BOOKING_DURATION_UNITS = ['working_days', 'minutes'] as const

export type BookingDurationUnit = (typeof BOOKING_DURATION_UNITS)[number]

export const BOOKING_PARTICIPANT_ROLES = ['performer', 'place', 'supporting'] as const

export type BookingParticipantRole = (typeof BOOKING_PARTICIPANT_ROLES)[number]

// Classes are declared before the classes that reference them: decorator metadata reads the type at definition time.

@Entity({ tableName: 'bookings_subject_categories' })
@Index({
  name: 'bookings_subject_categories_org_tenant_deleted_idx',
  properties: ['organizationId', 'tenantId', 'deletedAt'],
})
@Index({
  name: 'bookings_subject_categories_org_name_uq',
  expression:
    `create unique index "bookings_subject_categories_org_name_uq" on "bookings_subject_categories" ("organization_id", "tenant_id", lower("name")) where "deleted_at" is null`,
})
export class BookingSubjectCategory {
  [OptionalProps]?: 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'name', type: 'text' })
  name!: string

  @Property({ name: 'icon', type: 'text', nullable: true })
  icon?: string | null

  @Property({ name: 'color', type: 'text', nullable: true })
  color?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'bookings_subjects' })
@Index({
  name: 'bookings_subjects_org_tenant_deleted_idx',
  properties: ['organizationId', 'tenantId', 'deletedAt'],
})
@Index({
  name: 'bookings_subjects_category_idx',
  properties: ['category'],
})
@Index({
  name: 'bookings_subjects_provider_record_uq',
  expression:
    `create unique index "bookings_subjects_provider_record_uq" on "bookings_subjects" ("organization_id", "tenant_id", "provider_key", "provider_record_id") where "deleted_at" is null`,
})
export class BookingSubject {
  [OptionalProps]?: 'isActive' | 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @ManyToOne(() => BookingSubjectCategory, { fieldName: 'category_id', nullable: true })
  category?: BookingSubjectCategory | null

  @Property({ name: 'provider_key', type: 'text' })
  providerKey!: string

  @Property({ name: 'provider_record_id', type: 'text' })
  providerRecordId!: string

  @Property({ name: 'name', type: 'text' })
  name!: string

  @Property({ name: 'time_zone', type: 'text' })
  timeZone!: string

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'bookings_targets' })
@Index({
  name: 'bookings_targets_org_tenant_deleted_idx',
  properties: ['organizationId', 'tenantId', 'deletedAt'],
})
@Index({
  name: 'bookings_targets_org_name_idx',
  properties: ['organizationId', 'name'],
})
export class BookingTarget {
  [OptionalProps]?: 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'name', type: 'text' })
  name!: string

  @Property({ name: 'time_zone', type: 'text' })
  timeZone!: string

  @Property({ name: 'color', type: 'text', nullable: true })
  color?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'bookings_bookings' })
@Index({
  name: 'bookings_bookings_org_tenant_deleted_idx',
  properties: ['organizationId', 'tenantId', 'deletedAt'],
})
@Index({
  name: 'bookings_bookings_open_window_idx',
  expression:
    `create index "bookings_bookings_open_window_idx" on "bookings_bookings" ("organization_id", "start_at", "end_at") where "deleted_at" is null and "status" in (${OPEN_STATUSES_SQL})`,
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

@Entity({ tableName: 'bookings_settings' })
@Unique({
  name: 'bookings_settings_org_tenant_uq',
  properties: ['organizationId', 'tenantId'],
})
@Check({
  name: 'bookings_settings_warning_threshold_chk',
  expression: `"warning_threshold_working_days" >= 0`,
})
export class BookingsSettings {
  [OptionalProps]?:
    | 'freeOnMonday'
    | 'freeOnTuesday'
    | 'freeOnWednesday'
    | 'freeOnThursday'
    | 'freeOnFriday'
    | 'freeOnSaturday'
    | 'freeOnSunday'
    | 'warningThresholdWorkingDays'
    | 'conflictPolicy'
    | 'createdAt'
    | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'free_on_monday', type: 'boolean', default: false })
  freeOnMonday: boolean = false

  @Property({ name: 'free_on_tuesday', type: 'boolean', default: false })
  freeOnTuesday: boolean = false

  @Property({ name: 'free_on_wednesday', type: 'boolean', default: false })
  freeOnWednesday: boolean = false

  @Property({ name: 'free_on_thursday', type: 'boolean', default: false })
  freeOnThursday: boolean = false

  @Property({ name: 'free_on_friday', type: 'boolean', default: false })
  freeOnFriday: boolean = false

  @Property({ name: 'free_on_saturday', type: 'boolean', default: true })
  freeOnSaturday: boolean = true

  @Property({ name: 'free_on_sunday', type: 'boolean', default: true })
  freeOnSunday: boolean = true

  @Property({ name: 'warning_threshold_working_days', type: 'integer', default: 5 })
  warningThresholdWorkingDays: number = 5

  @Property({ name: 'time_zone', type: 'text' })
  timeZone!: string

  @Enum({ name: 'conflict_policy', items: () => BOOKING_CONFLICT_POLICIES, type: 'text', default: 'advisory' })
  conflictPolicy: BookingConflictPolicy = 'advisory'

  @Property({ name: 'last_scan_local_date', type: 'date', nullable: true })
  lastScanLocalDate?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'bookings_holidays' })
@Index({
  name: 'bookings_holidays_org_date_uq',
  expression:
    `create unique index "bookings_holidays_org_date_uq" on "bookings_holidays" ("organization_id", "tenant_id", "holiday_on") where "deleted_at" is null`,
})
export class BookingsHoliday {
  [OptionalProps]?: 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'holiday_on', type: 'date' })
  holidayOn!: string

  @Property({ name: 'label', type: 'text', nullable: true })
  label?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'bookings_conflict_policy_exceptions' })
@Index({
  name: 'bookings_conflict_policy_exceptions_org_tenant_deleted_idx',
  properties: ['organizationId', 'tenantId', 'deletedAt'],
})
@Index({
  name: 'bookings_conflict_policy_exceptions_category_uq',
  expression:
    `create unique index "bookings_conflict_policy_exceptions_category_uq" on "bookings_conflict_policy_exceptions" ("organization_id", "tenant_id", "category_id") where "deleted_at" is null`,
})
export class BookingConflictPolicyException {
  [OptionalProps]?: 'mode' | 'createdAt' | 'updatedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @ManyToOne(() => BookingSubjectCategory, { fieldName: 'category_id' })
  category!: BookingSubjectCategory

  @Enum({ name: 'mode', items: () => BOOKING_CONFLICT_POLICIES, type: 'text', default: 'reject' })
  mode: BookingConflictPolicy = 'reject'

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
