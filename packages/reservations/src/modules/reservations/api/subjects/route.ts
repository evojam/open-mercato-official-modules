import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { errorSchema, subjectRowDtoSchema } from '../../data/validators'
import { subjectFixtures } from '../../data/fixtures'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['reservations.view'] },
}

export async function GET() {
  return NextResponse.json({ items: subjectFixtures, total: subjectFixtures.length })
}

const subjectsResponseSchema = z.object({
  items: z.array(subjectRowDtoSchema),
  total: z.number().int(),
})

export const openApi: OpenApiRouteDoc = {
  summary: 'Reservation subjects',
  methods: {
    GET: {
      summary: 'List subjects of a provider',
      description:
        'Paged subject rows from the requested SubjectProvider (query: provider, categoryId?, page?, pageSize?). Mocked in SD-51.',
      tags: ['Reservations'],
      responses: [{ status: 200, description: 'Subject rows', schema: subjectsResponseSchema }],
      errors: [
        { status: 400, description: 'Invalid params', schema: errorSchema },
        { status: 404, description: 'Unknown provider key', schema: errorSchema },
      ],
    },
  },
}
