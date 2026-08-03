import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { errorSchema, replaceSettingsSchema, settingsDtoSchema } from '../../data/validators'
import { settingsFixture } from '../../data/fixtures'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['reservations.view'] },
  PUT: { requireAuth: true, requireFeatures: ['reservations.manage_settings'] },
}

export async function GET() {
  return NextResponse.json(settingsFixture)
}

export async function PUT() {
  return NextResponse.json({ ok: true })
}

const okResponseSchema = z.object({ ok: z.literal(true) })

export const openApi: OpenApiRouteDoc = {
  summary: 'Reservations settings',
  methods: {
    GET: {
      summary: 'Get org settings',
      description: 'Working calendar (soft), coverage threshold, org timezone. Defaults when no row yet.',
      tags: ['Reservations'],
      responses: [{ status: 200, description: 'Settings', schema: settingsDtoSchema }],
      errors: [],
    },
    PUT: {
      summary: 'Replace org settings',
      tags: ['Reservations'],
      requestBody: { schema: replaceSettingsSchema },
      responses: [{ status: 200, description: 'Replaced', schema: okResponseSchema }],
      errors: [
        { status: 400, description: 'Invalid input', schema: errorSchema },
        { status: 409, description: 'concurrent_modification', schema: errorSchema },
      ],
    },
  },
}
