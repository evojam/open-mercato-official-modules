import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { BookingSubject, BookingSubjectCategory } from '../../data/entities'
import { bookingSubjectAddSchema, bookingSubjectUpdateSchema } from '../../data/validators'
import { SUBJECT_KINDS } from '../../services/subjects/providers/provider'
import { getSubjectProvider } from '../../services/subjects/providers/registry'
import { crudListQuerySchema, nameAndIdFilters, plainListItems, sortItemsByName } from '../crud-list'
import { createBookingsCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['bookings.view'] },
  POST: { requireAuth: true, requireFeatures: ['bookings.manage_bookings'] },
  PUT: { requireAuth: true, requireFeatures: ['bookings.manage_bookings'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const subjectListQuerySchema = crudListQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  providerKey: z.string().max(64).optional(),
  isActive: z.enum(['true', 'false']).optional(),
})

type SubjectRow = Record<string, unknown> & { providerKey?: string; providerRecordId?: string; category?: unknown }

function categoryIdOf(row: SubjectRow): string | null {
  const value = row.category
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') return (value as { id: string }).id
  return null
}

async function decorateSubjects(payload: { items?: unknown[] }, em: EntityManager, tenantId: string | null): Promise<void> {
  const items = plainListItems<SubjectRow>(payload)
  const categoryIds = [...new Set(items.map(categoryIdOf).filter((id): id is string => id !== null))]
  const organizationIds = [...new Set(items.map((row) => String(row.organizationId ?? '')).filter(Boolean))]
  const categories =
    categoryIds.length && tenantId
      ? await em.find(
          BookingSubjectCategory,
          { id: { $in: categoryIds }, tenantId, organizationId: { $in: organizationIds } },
          { fields: ['id', 'name', 'icon', 'color', 'deletedAt'] }
        )
      : []
  const byId = new Map(categories.map((category) => [category.id, category]))
  for (const row of items) {
    const provider = row.providerKey ? getSubjectProvider(row.providerKey) : undefined
    const category = byId.get(categoryIdOf(row) ?? '')
    Object.assign(row, {
      categoryId: categoryIdOf(row),
      category: category && !category.deletedAt ? { id: category.id, name: category.name, icon: category.icon ?? null, color: category.color ?? null } : null,
      kind: provider?.kind ?? null,
      providerAvailable: Boolean(provider),
      cardHref: provider && row.providerRecordId ? provider.cardHref(row.providerRecordId) : null,
    })
  }
  sortItemsByName(payload)
}

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: BookingSubject,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  list: {
    schema: subjectListQuerySchema,
    buildFilters: async (query) => {
      const filters = nameAndIdFilters(query)
      if (query.categoryId) filters.category = query.categoryId
      if (query.providerKey) filters.providerKey = query.providerKey
      if (query.isActive) filters.isActive = query.isActive === 'true'
      return filters
    },
  },
  hooks: {
    afterList: async (payload, ctx) =>
      decorateSubjects(payload, (ctx.container.resolve('em') as EntityManager).fork(), ctx.auth?.tenantId ?? null),
  },
  actions: {
    create: {
      commandId: 'bookings.subjects.add',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return withScopedPayload((raw ?? {}) as Record<string, unknown>, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.id ?? null }),
      status: 201,
    },
    update: {
      commandId: 'bookings.subjects.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return withScopedPayload((raw ?? {}) as Record<string, unknown>, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
  },
})

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT

const subjectListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  providerKey: z.string(),
  providerRecordId: z.string(),
  providerAvailable: z.boolean(),
  kind: z.enum(SUBJECT_KINDS).nullable(),
  cardHref: z.string().nullable(),
  categoryId: z.string().uuid().nullable(),
  category: z.object({ id: z.string(), name: z.string(), icon: z.string().nullable(), color: z.string().nullable() }).nullable(),
  timeZone: z.string(),
  isActive: z.boolean(),
  updatedAt: z.string(),
})

export const openApi = createBookingsCrudOpenApi({
  resourceName: 'Subject',
  pluralName: 'Subjects',
  querySchema: subjectListQuerySchema,
  listResponseSchema: createPagedListResponseSchema(subjectListItemSchema),
  create: {
    schema: bookingSubjectAddSchema,
    description:
      'Adds a subject: `existing` attaches a record the provider already holds, `new` creates it in the provider registry first and then attaches it.',
  },
  update: {
    schema: bookingSubjectUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Changes the category, the time zone or whether the subject is still in use. Subjects are never deleted.',
  },
})
