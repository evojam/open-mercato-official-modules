import { OptionalProps } from '@mikro-orm/core'
import { Check, Entity, Enum, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { BOOKING_CONFLICT_POLICIES } from '../../../../../lib/pure-engine/conflict-policy.rule'
import type { BookingConflictPolicy } from '../../../../../lib/pure-engine/conflict-policy.rule'

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
