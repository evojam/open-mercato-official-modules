import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

@Entity({ tableName: 'bookings_holidays' })
@Index({
  name: 'bookings_holidays_org_tenant_date_idx',
  properties: ['organizationId', 'tenantId', 'holidayOn'],
})
@Index({
  name: 'bookings_holidays_org_date_uq',
  expression:
    `create unique index "bookings_holidays_org_date_uq" on "bookings_holidays" ("tenant_id", "organization_id", "holiday_on") where "deleted_at" is null`,
})
export class BookingsHoliday {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'holiday_on', type: 'date' })
  holidayOn!: Date

  @Property({ name: 'label', type: 'text', nullable: true })
  label?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
