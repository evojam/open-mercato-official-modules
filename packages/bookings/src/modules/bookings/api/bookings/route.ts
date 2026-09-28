import { z } from 'zod'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { BOOKING_STATUSES } from '../../../../lib/pure-engine'
import { Booking } from '../../data/entities'
import { bookingCreateSchema } from '../../data/validators'
import type { BookingCreateResult } from '../../commands/bookings/create-booking.command'
import { crudListQuerySchema } from '../crud-list'
import { createBookingsCrudOpenApi, createPagedListResponseSchema } from '../openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['bookings.view'] },
  POST: { requireAuth: true, requireFeatures: ['bookings.manage_bookings'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const bookingListQuerySchema = crudListQuerySchema.extend({
  targetId: z.string().uuid().optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
})

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: Booking,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  list: {
    schema: bookingListQuerySchema,
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.id) filters.id = { $in: [query.id] }
      if (query.targetId) filters.target = query.targetId
      if (query.status) filters.status = query.status
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'bookings.bookings.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return withScopedPayload((raw ?? {}) as Record<string, unknown>, ctx, translate)
      },
      response: ({ result }) => {
        const created = result as BookingCreateResult | undefined
        return { id: created?.id ?? null, conflicts: created?.conflicts ?? [], warnings: created?.warnings ?? [] }
      },
      status: 201,
    },
  },
})

export const GET = crud.GET
export const POST = crud.POST

const bookingListItemSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(BOOKING_STATUSES),
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  durationValue: z.string(),
  expectedStartOn: z.string(),
  note: z.string().nullable(),
  updatedAt: z.string(),
})

const conflictSchema = z.object({
  kind: z.enum(['overlap', 'unavailability']),
  subjectId: z.string(),
  bookingId: z.string(),
  from: z.string(),
  to: z.string(),
  withBookingId: z.string().optional(),
  withTargetName: z.string().optional(),
  withWindowId: z.string().optional(),
  reasonLabel: z.string().optional(),
})

export const openApi = createBookingsCrudOpenApi({
  resourceName: 'Booking',
  pluralName: 'Bookings',
  querySchema: bookingListQuerySchema,
  listResponseSchema: createPagedListResponseSchema(bookingListItemSchema),
  create: {
    schema: bookingCreateSchema,
    responseSchema: z.object({
      id: z.string().uuid(),
      conflicts: z.array(conflictSchema),
      warnings: z.array(z.enum(['start_on_free_day'])),
    }),
    description:
      'Creates a booking for one or more subjects. With a start date it is placed for the given working days in the target zone; under reject a clash with another booking fails with 409.',
  },
})
