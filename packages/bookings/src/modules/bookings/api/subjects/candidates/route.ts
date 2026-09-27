import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { QueryEngine } from '@open-mercato/shared/lib/query/types'
import { BookingSubject } from '../../../data/entities'
import { bookingsErrors } from '../../../lib/errors'
import { getSubjectProvider } from '../../../services/subjects/providers/registry'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['bookings.manage_bookings'] },
}

const querySchema = z.object({
  providerKey: z.string().min(1).max(64),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
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
    const provider = getSubjectProvider(query.providerKey)
    if (!provider) throw bookingsErrors.unknownProvider(query.providerKey)

    const em = (container.resolve('em') as EntityManager).fork()
    const attached = await em.find(
      BookingSubject,
      { ...scope, providerKey: provider.key, deletedAt: null },
      { fields: ['providerRecordId'] }
    )
    const queryEngine = container.resolve('queryEngine') as QueryEngine
    const page = await provider.listCandidates(
      { queryEngine, scope },
      {
        search: query.search,
        excludeIds: attached.map((subject) => subject.providerRecordId),
        page: query.page,
        pageSize: query.pageSize,
      }
    )
    return NextResponse.json({ items: page.items, total: page.total, page: query.page, pageSize: query.pageSize })
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    console.error('bookings.subjects.candidates failed', err)
    return NextResponse.json({ error: 'bookings.subjects.errors.candidatesFailed' }, { status: 500 })
  }
}

const candidateSchema = z.object({ recordId: z.string(), name: z.string(), isActive: z.boolean() })

export const openApi: OpenApiRouteDoc = {
  tag: 'Bookings',
  summary: 'Provider records that can still be attached as subjects',
  methods: {
    GET: {
      summary: 'List records of one provider that are not subjects yet',
      query: querySchema,
      responses: [
        {
          status: 200,
          description: 'One page of candidates, sorted by name',
          schema: z.object({ items: z.array(candidateSchema), total: z.number(), page: z.number(), pageSize: z.number() }),
        },
        { status: 400, description: 'Unknown provider or invalid query', schema: z.object({ error: z.string(), code: z.string() }) },
      ],
    },
  },
}
