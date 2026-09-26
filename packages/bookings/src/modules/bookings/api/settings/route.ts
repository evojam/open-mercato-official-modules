import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { runCrudMutationGuardAfterSuccess, validateCrudMutationGuard } from '@open-mercato/shared/lib/crud/mutation-guard'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { BOOKINGS_SETTINGS_RESOURCE_KIND } from '../../commands/settings/save-settings.command'
import { BOOKING_CONFLICT_POLICIES } from '../../data/entities'
import { bookingsSettingsSaveSchema, bookingsSettingsUpdateSchema } from '../../data/validators'
import type { BookingsSettingsSaveInput } from '../../data/validators'
import { loadBookingsSettings, readBookingsSettingsView } from '../../services/settings/effective-settings'
import type { BookingsSettingsView } from '../../services/settings/effective-settings'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['bookings.manage_settings'] },
  PUT: { requireAuth: true, requireFeatures: ['bookings.manage_settings'] },
}

type SettingsRouteContext = {
  ctx: CommandRuntimeContext
  em: EntityManager
  tenantId: string
  organizationId: string
  userId: string
  translate: (key: string, fallback?: string) => string
}

async function resolveSettingsContext(req: Request): Promise<SettingsRouteContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  const { translate } = await resolveTranslations()
  if (!auth || !auth.tenantId) {
    throw new CrudHttpError(401, { error: translate('bookings.errors.unauthorized', 'Unauthorized') })
  }
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const organizationId = scope?.selectedId ?? auth.orgId ?? null
  if (!organizationId) {
    throw new CrudHttpError(400, {
      error: translate('bookings.errors.organizationRequired', 'Organization context is required'),
      code: 'organization_required',
    })
  }
  const ctx: CommandRuntimeContext = {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: organizationId,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
  return {
    ctx,
    em: container.resolve('em') as EntityManager,
    tenantId: auth.tenantId,
    organizationId,
    userId: auth.sub,
    translate,
  }
}

function errorResponse(err: unknown, fallbackKey: string, fallback: string, translate: (key: string, fallback?: string) => string) {
  if (isCrudHttpError(err)) return NextResponse.json(err.body, { status: err.status })
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: 'bookings.settings.errors.invalid',
        code: 'invalid_input',
        details: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      },
      { status: 400 }
    )
  }
  console.error(fallbackKey, err)
  return NextResponse.json({ error: translate(fallbackKey, fallback) }, { status: 500 })
}

export async function GET(req: Request) {
  try {
    const { em, tenantId, organizationId } = await resolveSettingsContext(req)
    return NextResponse.json(await readBookingsSettingsView(em, { tenantId, organizationId }))
  } catch (err) {
    const { translate } = await resolveTranslations()
    return errorResponse(err, 'bookings.settings.errors.loadFailed', 'Failed to load booking settings', translate)
  }
}

export async function PUT(req: Request) {
  try {
    const { ctx, em, tenantId, organizationId, userId, translate } = await resolveSettingsContext(req)
    const update = bookingsSettingsUpdateSchema.parse(await readJsonSafe(req, {}))
    const input = bookingsSettingsSaveSchema.parse(withScopedPayload(update, ctx, translate))
    const existing = await loadBookingsSettings(em, { tenantId, organizationId })

    const guardInput = {
      tenantId,
      organizationId,
      userId,
      resourceKind: BOOKINGS_SETTINGS_RESOURCE_KIND,
      resourceId: organizationId,
      operation: existing ? ('update' as const) : ('create' as const),
      requestMethod: req.method,
      requestHeaders: req.headers,
    }
    const guard = await validateCrudMutationGuard(ctx.container, { ...guardInput, mutationPayload: input })
    if (guard && !guard.ok) return NextResponse.json(guard.body, { status: guard.status })

    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<BookingsSettingsSaveInput, BookingsSettingsView>('bookings.settings.save', {
      input,
      ctx,
    })

    if (guard?.ok && guard.shouldRunAfterSuccess) {
      await runCrudMutationGuardAfterSuccess(ctx.container, { ...guardInput, metadata: guard.metadata ?? null })
    }
    return NextResponse.json(result)
  } catch (err) {
    const { translate } = await resolveTranslations()
    return errorResponse(err, 'bookings.settings.errors.saveFailed', 'Failed to save booking settings', translate)
  }
}

const settingsViewSchema = z.object({
  isSaved: z.boolean(),
  timeZone: z.string().nullable(),
  freeWeekdays: z.array(z.number().int().min(0).max(6)),
  holidays: z.array(z.object({ date: z.string(), label: z.string().nullable() })),
  warningThresholdWorkingDays: z.number().int(),
  conflictPolicy: z.enum(BOOKING_CONFLICT_POLICIES),
  updatedAt: z.string().nullable(),
})

const errorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Bookings',
  summary: 'Booking module settings',
  methods: {
    GET: {
      summary: 'Get the working calendar, warning threshold, time zone and conflict policy',
      description: 'Answers from the built-in defaults, with a null time zone, until the settings are first saved.',
      responses: [
        { status: 200, description: 'Current settings', schema: settingsViewSchema },
        { status: 401, description: 'Unauthorized', schema: errorSchema },
        { status: 400, description: 'No organization in scope', schema: errorSchema },
      ],
    },
    PUT: {
      summary: 'Save one or more sections of the settings',
      description: 'Every field is optional. The first save must carry a time zone; it creates the settings row.',
      requestBody: { contentType: 'application/json', schema: bookingsSettingsUpdateSchema },
      responses: [
        { status: 200, description: 'Settings after the save', schema: settingsViewSchema },
        { status: 400, description: 'Invalid settings, or a first save without a time zone', schema: errorSchema },
        { status: 401, description: 'Unauthorized', schema: errorSchema },
        { status: 409, description: 'Settings were created concurrently', schema: errorSchema },
      ],
    },
  },
}
