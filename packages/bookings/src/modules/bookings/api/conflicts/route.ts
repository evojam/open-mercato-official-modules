import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { isTimelineRangeAllowed } from '../../../../lib/timeline/layout/range'
import { MAX_BOOKING_PARTICIPANTS, isoDateSchema } from '../../data/validators'
import { bookingsErrors } from '../../lib/errors'
import { findConflicts } from '../../services/bookings/conflict-check.service'
import { conflictSchema, errorResponseSchema } from '../openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['bookings.view'] },
}

const MAX_PREVIEW_SUBJECTS = 100

const uuid = z.string().uuid({ message: 'bookings.conflicts.errors.subjectIds' })

const querySchema = z
  .object({
    subjectIds: z
      .string()
      .transform((value) => value.split(',').map((id) => id.trim()).filter(Boolean))
      .pipe(z.array(uuid).min(1, { message: 'bookings.conflicts.errors.subjectIds' }).max(MAX_PREVIEW_SUBJECTS)),
    from: isoDateSchema('bookings.conflicts.errors.invalidDate'),
    to: isoDateSchema('bookings.conflicts.errors.invalidDate'),
    excludeBookingId: z.string().uuid().optional(),
  })
  .refine((query) => query.from < query.to && isTimelineRangeAllowed({ from: query.from, to: query.to }), {
    message: 'bookings.conflicts.errors.invalidRange',
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
    const conflicts = await findConflicts(em, scope, {
      bookingId: query.excludeBookingId,
      subjectIds: query.subjectIds,
      days: { from: query.from, to: query.to },
      status: 'planned',
    })
    return NextResponse.json({ conflicts })
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    console.error('bookings.conflicts failed', err)
    return NextResponse.json({ error: 'bookings.conflicts.errors.loadFailed' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bookings',
  summary: 'Conflicts of subjects in a date range',
  methods: {
    GET: {
      summary: 'What the given subjects clash with if they were busy on these days',
      description:
        `Up to ${MAX_PREVIEW_SUBJECTS} subjects, "from" inclusive and "to" exclusive, at most a year. Pass excludeBookingId when previewing a change to an existing booking so it does not clash with itself.`,
      query: querySchema,
      responses: [
        { status: 200, description: 'Conflicts per subject, each with its kind and other side', schema: z.object({ conflicts: z.array(conflictSchema) }) },
        { status: 400, description: 'Invalid subjects or range', schema: errorResponseSchema },
      ],
    },
  },
}
