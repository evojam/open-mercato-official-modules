import { NextResponse } from 'next/server'
import type { ZodTypeAny } from 'zod'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { serializeOperationMetadata } from '@open-mercato/shared/lib/commands/operationMetadata'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { bookingsErrors } from './errors'

export type CommandActionRouteOptions = {
  commandId: string
  schema: ZodTypeAny
  feature: string
  resourceKind: string
  summary: string
  description: string
  responseSchema: ZodTypeAny
  errorSchema: ZodTypeAny
}

async function commandContextOf(req: Request): Promise<CommandRuntimeContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId) throw bookingsErrors.unauthorized()
  const organizationScope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const organizationId = organizationScope?.selectedId ?? auth.orgId ?? null
  if (!organizationId) throw bookingsErrors.organizationRequired()
  return {
    container,
    auth,
    organizationScope,
    selectedOrganizationId: organizationId,
    organizationIds: organizationScope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
}

export function makeCommandActionRoute(options: CommandActionRouteOptions) {
  const metadata = { POST: { requireAuth: true, requireFeatures: [options.feature] } }

  async function POST(req: Request) {
    try {
      const ctx = await commandContextOf(req)
      const { translate } = await resolveTranslations()
      const raw = await req.json().catch(() => ({}))
      const scoped = withScopedPayload((raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>, ctx, translate)
      const parsed = options.schema.safeParse(scoped)
      if (!parsed.success) throw bookingsErrors.invalidInput(parsed.error)
      const commandBus = ctx.container.resolve('commandBus') as CommandBus
      const { result, logEntry } = await commandBus.execute(options.commandId, { input: parsed.data, ctx })
      const response = NextResponse.json(result ?? {})
      if (logEntry?.undoToken && logEntry.id && logEntry.commandId) {
        response.headers.set(
          'x-om-operation',
          serializeOperationMetadata({
            id: logEntry.id,
            undoToken: logEntry.undoToken,
            commandId: logEntry.commandId,
            actionLabel: logEntry.actionLabel ?? null,
            resourceKind: logEntry.resourceKind ?? options.resourceKind,
            resourceId: logEntry.resourceId ?? null,
            executedAt: logEntry.createdAt instanceof Date ? logEntry.createdAt.toISOString() : new Date().toISOString(),
          })
        )
      }
      return response
    } catch (err) {
      if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
      console.error(`${options.commandId} failed`, err)
      return NextResponse.json({ error: 'bookings.errors.actionFailed', code: 'action_failed' }, { status: 500 })
    }
  }

  const openApi: OpenApiRouteDoc = {
    tag: 'Bookings',
    summary: options.summary,
    methods: {
      POST: {
        summary: options.summary,
        description: options.description,
        requestBody: { contentType: 'application/json', schema: options.schema },
        responses: [
          { status: 200, description: 'The write went through; conflicts and warnings are listed', schema: options.responseSchema },
          { status: 400, description: 'Invalid input', schema: options.errorSchema },
          { status: 404, description: 'Booking not found', schema: options.errorSchema },
          { status: 409, description: 'Refused by the conflict policy or missing settings', schema: options.errorSchema },
          { status: 422, description: 'The booking is in a state that does not allow this write', schema: options.errorSchema },
        ],
      },
    },
  }

  return { metadata, POST, openApi }
}
