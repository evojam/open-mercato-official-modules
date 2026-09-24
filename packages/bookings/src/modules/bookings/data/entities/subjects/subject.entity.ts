import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { BookingSubjectCategory } from './category.entity'

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
