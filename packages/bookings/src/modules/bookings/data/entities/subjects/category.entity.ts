import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

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
