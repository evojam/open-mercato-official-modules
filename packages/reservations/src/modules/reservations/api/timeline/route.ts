import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { errorSchema, timelineRowDtoSchema } from '../../data/validators'
import { settingsFixture, timelineRowFixtures } from '../../data/fixtures'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['reservations.view'] },
}

export async function GET() {
  return NextResponse.json({
    items: timelineRowFixtures,
    total: timelineRowFixtures.length,
    timezone: settingsFixture.timezone,
    offWeekdays: settingsFixture.offWeekdays,
    holidays: settingsFixture.holidays,
  })
}

const timelineResponseSchema = z.object({
  items: z.array(timelineRowDtoSchema),
  total: z.number().int(),
  timezone: z.string(),
  offWeekdays: z.array(z.number().int()),
  holidays: z.array(z.string()),
})

export const openApi: OpenApiRouteDoc = {
  summary: 'Reservations timeline',
  methods: {
    GET: {
      summary: 'Read the timeline board rows',
      description:
        'Subject lanes with placed reservations and unavailability windows for the requested range (query: provider, from, to, categoryId?, page?, pageSize?). Paging applies to subject rows. Mocked in SD-51 — deterministic fixtures.',
      tags: ['Reservations'],
      responses: [{ status: 200, description: 'Timeline rows', schema: timelineResponseSchema }],
      errors: [
        { status: 400, description: 'Invalid window or params', schema: errorSchema },
        { status: 404, description: 'Unknown provider key', schema: errorSchema },
      ],
    },
  },
}
