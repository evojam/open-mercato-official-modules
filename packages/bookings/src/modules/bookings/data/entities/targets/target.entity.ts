import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

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
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'name', type: 'text' })
  name!: string

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
