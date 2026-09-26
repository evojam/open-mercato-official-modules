import { z } from 'zod'
import { parseScopedCommandInput, resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { BookingSubjectCategory } from '../../data/entities'
import { bookingCategoryCreateSchema, bookingCategoryUpdateSchema } from '../../data/validators'
import { crudListQuerySchema, nameAndIdFilters } from '../crud-list'
import { createBookingsCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['bookings.view'] },
  POST: { requireAuth: true, requireFeatures: ['bookings.manage_settings'] },
  PUT: { requireAuth: true, requireFeatures: ['bookings.manage_settings'] },
  DELETE: { requireAuth: true, requireFeatures: ['bookings.manage_settings'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: BookingSubjectCategory,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  list: {
    schema: crudListQuerySchema,
    buildFilters: async (query) => nameAndIdFilters(query),
  },
  actions: {
    create: {
      commandId: 'bookings.categories.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(bookingCategoryCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.id ?? null }),
      status: 201,
    },
    update: {
      commandId: 'bookings.categories.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(bookingCategoryUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'bookings.categories.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        return { id: resolveCrudRecordId(parsed, ctx, translate) }
      },
      response: () => ({ ok: true }),
    },
  },
})

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const categoryListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  updatedAt: z.string(),
})

export const openApi = createBookingsCrudOpenApi({
  resourceName: 'Subject category',
  pluralName: 'Subject categories',
  querySchema: crudListQuerySchema,
  listResponseSchema: createPagedListResponseSchema(categoryListItemSchema),
  create: {
    schema: bookingCategoryCreateSchema,
    description: 'Creates a subject category; without a color it takes the next free palette color.',
  },
  update: { schema: bookingCategoryUpdateSchema, responseSchema: defaultOkResponseSchema, description: 'Updates a subject category by id.' },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a subject category by id.',
  },
})
