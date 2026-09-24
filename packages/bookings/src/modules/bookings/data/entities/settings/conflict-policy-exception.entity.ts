import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { BookingSubjectCategory } from '../subjects/category.entity'
import { BOOKING_CONFLICT_POLICIES, type BookingConflictPolicy } from '../../../../../lib/pure-engine/conflict-policy.rule'

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
