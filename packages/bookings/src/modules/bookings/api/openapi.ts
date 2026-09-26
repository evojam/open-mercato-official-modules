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
