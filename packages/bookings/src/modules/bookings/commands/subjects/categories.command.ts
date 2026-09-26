import { nextPaletteColor } from '../../../../lib/timeline/palette'
import { BookingConflictPolicyException, BookingSubject, BookingSubjectCategory } from '../../data/entities'
import { bookingCategoryCreateSchema, bookingCategoryUpdateSchema } from '../../data/validators'
import type { BookingCategoryCreateInput } from '../../data/validators'
import { bookingsErrors } from '../../lib/errors'
import { registerScopedRecordCommands } from '../shared/scoped-record.commands'

export const BOOKING_CATEGORY_RESOURCE_KIND = 'bookings.subject_category'

export const bookingCategoryCommands = registerScopedRecordCommands<BookingSubjectCategory, BookingCategoryCreateInput>({
  commandPrefix: 'bookings.categories',
  resourceKind: BOOKING_CATEGORY_RESOURCE_KIND,
  entity: BookingSubjectCategory,
  fields: ['name', 'icon', 'color'],
  createSchema: bookingCategoryCreateSchema,
  updateSchema: bookingCategoryUpdateSchema,
  labels: {
    create: ['bookings.audit.categories.create', 'Create subject category'],
    update: ['bookings.audit.categories.update', 'Update subject category'],
    delete: ['bookings.audit.categories.delete', 'Delete subject category'],
  },
  errors: {
    notFound: 'bookings.categories.errors.notFound',
    duplicate: { error: 'bookings.categories.errors.duplicate', code: 'category_name_taken' },
  },
  async valuesForCreate(em, input) {
    const scope = { tenantId: input.tenantId, organizationId: input.organizationId }
    const siblings = await em.find(BookingSubjectCategory, { ...scope, deletedAt: null }, { fields: ['color'] })
    return {
      name: input.name,
      icon: input.icon ?? null,
      color: input.color ?? nextPaletteColor(siblings.map((category) => category.color)),
    }
  },
  async beforeDelete(em, category) {
    const scope = { tenantId: category.tenantId, organizationId: category.organizationId, deletedAt: null }
    const [subjects, exceptions] = await Promise.all([
      em.count(BookingSubject, { ...scope, category: category.id }),
      em.count(BookingConflictPolicyException, { ...scope, category: category.id }),
    ])
    if (subjects > 0 || exceptions > 0) throw bookingsErrors.categoryInUse(subjects, exceptions)
  },
})
