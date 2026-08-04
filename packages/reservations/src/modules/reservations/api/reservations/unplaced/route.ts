import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { errorSchema, reservationListDtoSchema } from '../../../data/validators'
import { unplacedFixtures } from '../../../data/fixtures'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['reservations.view'] },
}

export async function GET() {
  return NextResponse.json({ items: unplacedFixtures, total: unplacedFixtures.length })
}

const listResponseSchema = z.object({
  items: z.array(reservationListDtoSchema),
  total: z.number().int(),
})

export const openApi: OpenApiRouteDoc = {
  summary: 'Reservations backlog',
  methods: {
    GET: {
      summary: 'List unplaced reservations',
      description: 'Reservations with no placement. Query: provider?, page?, pageSize?. Mocked in SD-51.',
      tags: ['Reservations'],
      responses: [{ status: 200, description: 'Paged backlog', schema: listResponseSchema }],
      errors: [{ status: 400, description: 'Invalid params', schema: errorSchema }],
    },
  },
}
