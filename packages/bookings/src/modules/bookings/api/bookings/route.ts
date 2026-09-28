import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { BOOKING_STATUSES } from '../../../../lib/pure-engine'
import { bookingDays } from '../../../../lib/time/day-ranges'
import type { BookingWriteResult } from '../../commands/shared/booking-write.commands'
import { Booking, BookingParticipant, BookingTarget } from '../../data/entities'
import { bookingCreateSchema, bookingUpdateSchema } from '../../data/validators'
import { crudListQuerySchema } from '../crud-list'
import { bookingWriteResponseSchema, createBookingsCrudOpenApi, createPagedListResponseSchema } from '../openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['bookings.view'] },
  POST: { requireAuth: true, requireFeatures: ['bookings.manage_bookings'] },
  PUT: { requireAuth: true, requireFeatures: ['bookings.manage_bookings'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const bookingListQuerySchema = crudListQuerySchema.extend({
  targetId: z.string().uuid().optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
})

type BookingRow = Record<string, unknown> & { id?: string; target?: unknown; startAt?: unknown; endAt?: unknown }

function targetIdOf(row: BookingRow): string | null {
  const value = row.target
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') return (value as { id: string }).id
  return null
}

function instantOf(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value === 'string' && value) return new Date(value)
  return null
}

async function decorateBookings(payload: { items?: BookingRow[] }, em: EntityManager): Promise<void> {
  const items = payload.items ?? []
  const ids = items.map((row) => row.id).filter((id): id is string => typeof id === 'string')
  const targetIds = [...new Set(items.map(targetIdOf).filter((id): id is string => id !== null))]
  const [participants, targets] = await Promise.all([
    ids.length ? em.find(BookingParticipant, { booking: { $in: ids }, deletedAt: null }, { fields: ['booking', 'subject'] }) : [],
    targetIds.length ? em.find(BookingTarget, { id: { $in: targetIds } }, { fields: ['id', 'timeZone'] }) : [],
  ])
  const subjectsByBooking = new Map<string, string[]>()
  for (const participant of participants) {
    const group = subjectsByBooking.get(participant.booking.id)
    if (group) group.push(participant.subject.id)
    else subjectsByBooking.set(participant.booking.id, [participant.subject.id])
  }
  const zoneByTarget = new Map(targets.map((target) => [target.id, target.timeZone]))
  for (const row of items) {
    const targetId = targetIdOf(row)
    const zone = targetId ? zoneByTarget.get(targetId) : undefined
    const startAt = instantOf(row.startAt)
    const endAt = instantOf(row.endAt)
    const days = zone && startAt && endAt ? bookingDays({ from: startAt, to: endAt }, zone) : null
    Object.assign(row, {
      targetId,
      subjectIds: (row.id && subjectsByBooking.get(row.id)) ?? [],
      startOn: days?.from ?? null,
      endOn: days?.to ?? null,
    })
  }
}

function writeResponse(result: unknown) {
  const written = result as BookingWriteResult | undefined
  return { id: written?.id ?? null, conflicts: written?.conflicts ?? [], warnings: written?.warnings ?? [] }
}

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
  hooks: {
    afterList: async (payload, ctx) => decorateBookings(payload, (ctx.container.resolve('em') as EntityManager).fork()),
  },
  actions: {
    create: {
      commandId: 'bookings.bookings.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return withScopedPayload((raw ?? {}) as Record<string, unknown>, ctx, translate)
      },
      response: ({ result }) => writeResponse(result),
      status: 201,
    },
    update: {
      commandId: 'bookings.bookings.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return withScopedPayload((raw ?? {}) as Record<string, unknown>, ctx, translate)
      },
      response: ({ result }) => writeResponse(result),
    },
  },
})

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT

const bookingListItemSchema = z.object({
  id: z.string().uuid(),
  targetId: z.string().uuid().nullable(),
  subjectIds: z.array(z.string().uuid()),
  status: z.enum(BOOKING_STATUSES),
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  startOn: z.string().nullable(),
  endOn: z.string().nullable(),
  durationValue: z.string(),
  expectedStartOn: z.string(),
  note: z.string().nullable(),
  updatedAt: z.string(),
})

export const openApi = createBookingsCrudOpenApi({
  resourceName: 'Booking',
  pluralName: 'Bookings',
  querySchema: bookingListQuerySchema,
  listResponseSchema: createPagedListResponseSchema(bookingListItemSchema),
  create: {
    schema: bookingCreateSchema,
    responseSchema: bookingWriteResponseSchema,
    description:
      'Creates a booking for one or more subjects. With a start date it is placed for the given working days in the target zone; under reject a clash with another booking fails with 409.',
  },
  update: {
    schema: bookingUpdateSchema,
    responseSchema: bookingWriteResponseSchema,
    description:
      'Edits the target, the participants, the expected start or the note of an open booking. A new target or participant set on a placed booking runs the conflict check again. Dates and length change through the action routes.',
  },
})
