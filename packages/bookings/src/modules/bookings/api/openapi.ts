import { z } from 'zod'
import type { ZodTypeAny } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  createCrudOpenApiFactory,
  createPagedListResponseSchema as createSharedPagedListResponseSchema,
  defaultCreateResponseSchema,
  defaultOkResponseSchema,
  type CrudOpenApiOptions,
} from '@open-mercato/shared/lib/openapi/crud'

export { defaultCreateResponseSchema, defaultOkResponseSchema }

export function createPagedListResponseSchema(itemSchema: ZodTypeAny) {
  return createSharedPagedListResponseSchema(itemSchema, { paginationMetaOptional: true })
}

const buildBookingsCrudOpenApi = createCrudOpenApiFactory({
  defaultTag: 'Bookings',
  defaultCreateResponseSchema,
  defaultOkResponseSchema,
  makeListDescription: ({ pluralLower }) => `Returns the ${pluralLower} of the authenticated organization.`,
})

export function createBookingsCrudOpenApi(options: CrudOpenApiOptions): OpenApiRouteDoc {
  return buildBookingsCrudOpenApi(options)
}

export const errorResponseSchema = z.object({ error: z.string(), code: z.string().optional() })

export const conflictSchema = z.object({
  kind: z.enum(['overlap', 'unavailability']),
  subjectId: z.string(),
  bookingId: z.string(),
  from: z.string(),
  to: z.string(),
  withBookingId: z.string().optional(),
  withTargetId: z.string().optional(),
  withTargetName: z.string().optional(),
  withWindowId: z.string().optional(),
  reasonLabel: z.string().optional(),
})

export const bookingWriteResponseSchema = z.object({
  id: z.string().uuid(),
  conflicts: z.array(conflictSchema),
  warnings: z.array(z.enum(['start_on_free_day'])),
})
