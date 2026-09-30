import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { QueryEngine } from '@open-mercato/shared/lib/query/types'
import { BOOKING_STATUSES } from '../../../../lib/pure-engine'
import { isTimelineRangeAllowed } from '../../../../lib/timeline/layout/range'
import { isIsoDate } from '../../../../lib/time/day-ranges'
import { bookingsErrors } from '../../lib/errors'
import { readTimeline } from '../../services/timeline/timeline-read.service'
import type { TimelineResponseDto } from '../../services/timeline/timeline-read.service'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['bookings.view'] },
}

type RbacService = {
  userHasAllFeatures: (
    userId: string,
    features: string[],
    scope: { tenantId: string | null; organizationId: string | null }
  ) => Promise<boolean>
}

const isoDate = z.string().refine(isIsoDate, { message: 'bookings.timeline.errors.invalidDate' })
const flag = z.enum(['true', 'false']).optional()

const querySchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    categoryId: z.string().uuid().optional(),
    conflictsOnly: flag,
    hideUnavailable: flag,
  })
  .refine((query) => (query.from === undefined) === (query.to === undefined), {
    message: 'bookings.timeline.errors.rangePair',
    path: ['to'],
    abort: true,
  })
  .refine((query) => !query.from || !query.to || isTimelineRangeAllowed({ from: query.from, to: query.to }), {
    message: 'bookings.timeline.errors.invalidRange',
    path: ['to'],
  })

export async function GET(req: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) throw bookingsErrors.unauthorized()
    const orgScope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = orgScope?.selectedId ?? auth.orgId ?? null
    if (!organizationId) throw bookingsErrors.organizationRequired()
    const scope = { tenantId: auth.tenantId, organizationId }

    const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
    if (!parsed.success) throw bookingsErrors.invalidInput(parsed.error)
    const query = parsed.data

    const em = (container.resolve('em') as EntityManager).fork()
    const queryEngine = container.resolve('queryEngine') as QueryEngine
    const rbac = container.resolve('rbacService') as RbacService
    const [canCreate, canWriteUnavailability] = auth.sub
      ? await Promise.all([
          rbac.userHasAllFeatures(auth.sub, ['bookings.manage_bookings'], scope),
          rbac.userHasAllFeatures(auth.sub, ['planner.manage_availability'], scope),
        ])
      : [false, false]
    const view = await readTimeline(
      { em, queryEngine },
      scope,
      {
        range: query.from && query.to ? { from: query.from, to: query.to } : undefined,
        categoryId: query.categoryId,
        conflictsOnly: query.conflictsOnly === 'true',
        hideUnavailable: query.hideUnavailable === 'true',
      },
      new Date()
    )
    return NextResponse.json({ ...view, canCreate, canWriteUnavailability } satisfies TimelineResponseDto)
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    console.error('bookings.timeline failed', err)
    return NextResponse.json({ error: 'bookings.timeline.errors.loadFailed' }, { status: 500 })
  }
}

const dayRangeSchema = z.object({ from: z.string(), to: z.string() })

const conflictSchema = z.discriminatedUnion('kind', [
  dayRangeSchema.extend({
    kind: z.literal('overlap'),
    subjectId: z.string(),
    bookingId: z.string(),
    withBookingId: z.string(),
    withTargetId: z.string().optional(),
    withTargetName: z.string().optional(),
  }),
  dayRangeSchema.extend({
    kind: z.literal('unavailability'),
    subjectId: z.string(),
    bookingId: z.string(),
    withWindowId: z.string(),
    reasonLabel: z.string().optional(),
  }),
])

const timelineSchema = z.object({
  range: dayRangeSchema,
  today: z.string(),
  wallClock: z.string(),
  timeZone: z.string(),
  calendar: z.object({ freeWeekdays: z.array(z.number().int().min(0).max(6)), holidays: z.array(z.string()) }),
  rows: z.array(
    z.object({
      subjectId: z.string(),
      name: z.string(),
      category: z
        .object({ id: z.string(), name: z.string(), icon: z.string().nullable(), color: z.string().nullable() })
        .nullable(),
      isActive: z.boolean(),
      providerKey: z.string(),
      cardHref: z.string().nullable(),
      unavailabilityKnown: z.boolean(),
    })
  ),
  bars: z.array(
    dayRangeSchema.extend({
      bookingId: z.string(),
      subjectId: z.string(),
      targetId: z.string(),
      targetName: z.string(),
      targetColor: z.string().nullable(),
      status: z.enum(BOOKING_STATUSES),
      durationValue: z.number(),
      expectedStartOn: z.string(),
      note: z.string().nullable(),
      conflicts: z.array(conflictSchema),
    })
  ),
  unavailability: z.array(
    dayRangeSchema.extend({ windowId: z.string(), subjectId: z.string(), reason: z.string().nullable() })
  ),
  canCreate: z.boolean(),
  canWriteUnavailability: z.boolean(),
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Bookings',
  summary: 'Timeline of subjects and their bookings',
  methods: {
    GET: {
      summary: 'Read rows, bars, unavailability and free days for a date range in one request',
      query: querySchema,
      responses: [
        { status: 200, description: 'Timeline for the range; two days back and a week in total when no range is given', schema: timelineSchema },
        { status: 400, description: 'Invalid range or filter', schema: z.object({ error: z.string(), code: z.string() }) },
        { status: 409, description: 'The organization has not saved its settings yet', schema: z.object({ error: z.string(), code: z.string() }) },
      ],
    },
  },
}
