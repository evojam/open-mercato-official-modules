import { z } from 'zod'
import { parseScopedCommandInput, resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { BookingTarget } from '../../data/entities'
import { bookingTargetCreateSchema, bookingTargetUpdateSchema } from '../../data/validators'
import { crudListQuerySchema, nameAndIdFilters, sortItemsByName } from '../crud-list'
import { createBookingsCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from '../openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['bookings.view'] },
  POST: { requireAuth: true, requireFeatures: ['bookings.manage_bookings'] },
  PUT: { requireAuth: true, requireFeatures: ['bookings.manage_bookings'] },
  DELETE: { requireAuth: true, requireFeatures: ['bookings.manage_bookings'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: BookingTarget,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  list: {
    schema: crudListQuerySchema,
    buildFilters: async (query) => nameAndIdFilters(query),
  },
  hooks: {
    afterList: async (payload) => sortItemsByName(payload),
  },
  actions: {
    create: {
      commandId: 'bookings.targets.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(bookingTargetCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.id ?? null }),
      status: 201,
    },
    update: {
      commandId: 'bookings.targets.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(bookingTargetUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'bookings.targets.delete',
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

const targetListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  timeZone: z.string(),
  color: z.string().nullable(),
  updatedAt: z.string(),
})

export const openApi = createBookingsCrudOpenApi({
  resourceName: 'Target',
  pluralName: 'Targets',
  querySchema: crudListQuerySchema,
  listResponseSchema: createPagedListResponseSchema(targetListItemSchema),
  create: {
    schema: bookingTargetCreateSchema,
    description: "Creates a target. Without a time zone it takes the organization's; without a color it takes the next free palette color.",
  },
  update: { schema: bookingTargetUpdateSchema, responseSchema: defaultOkResponseSchema, description: 'Updates a target by id.' },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a target by id; its bookings keep their history.',
  },
})
