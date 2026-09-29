import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { bookingsErrors } from '../../../lib/errors'
import { SUBJECT_KINDS } from '../../../services/subjects/providers/provider'
import { listSubjectProviders } from '../../../services/subjects/providers/registry'

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

export async function GET(req: Request) {
  try {
    // Building the container runs this module's di.ts, which is what fills the provider registry.
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) throw bookingsErrors.unauthorized()
    const orgScope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const scope = { tenantId: auth.tenantId, organizationId: orgScope?.selectedId ?? auth.orgId ?? null }
    const rbac = container.resolve('rbacService') as RbacService

    const items = await Promise.all(
      listSubjectProviders().map(async (provider) => ({
        key: provider.key,
        kind: provider.kind,
        labelKey: provider.labelKey,
        canCreate: auth.sub ? await rbac.userHasAllFeatures(auth.sub, [provider.createFeature], scope) : false,
      }))
    )
    return NextResponse.json({ items })
  } catch (err) {
    if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
    console.error('bookings.subjects.providers failed', err)
    return NextResponse.json({ error: 'bookings.subjects.errors.providersFailed' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bookings',
  summary: 'Registries subjects can come from',
  methods: {
    GET: {
      summary: 'List the registered subject providers and whether the caller may create records in each',
      responses: [
        {
          status: 200,
          description: 'Registered providers',
          schema: z.object({
            items: z.array(
              z.object({
                key: z.string(),
                kind: z.enum(SUBJECT_KINDS),
                labelKey: z.string(),
                canCreate: z.boolean(),
              })
            ),
          }),
        },
      ],
    },
  },
}
