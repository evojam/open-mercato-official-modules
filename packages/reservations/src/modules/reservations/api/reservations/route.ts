import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  createReservationSchema,
  errorSchema,
  reservationListDtoSchema,
} from '../../data/validators'
import { CREATED_RESERVATION_ID, reservationListFixtures } from '../../data/fixtures'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['reservations.view'] },
  POST: { requireAuth: true, requireFeatures: ['reservations.manage_reservations'] },
}

export async function GET() {
  return NextResponse.json({ items: reservationListFixtures, total: reservationListFixtures.length })
}

export async function POST() {
  return NextResponse.json({ id: CREATED_RESERVATION_ID }, { status: 201 })
}

const listResponseSchema = z.object({
  items: z.array(reservationListDtoSchema),
  total: z.number().int(),
})
const createdResponseSchema = z.object({ id: z.uuid() })

export const openApi: OpenApiRouteDoc = {
  summary: 'Reservations',
  methods: {
    GET: {
      summary: 'List reservations',
      description: 'Query: subjectType?, subjectId?, targetId?, status?, page?, pageSize?. Mocked in SD-51.',
      tags: ['Reservations'],
      responses: [{ status: 200, description: 'Paged reservations', schema: listResponseSchema }],
      errors: [{ status: 400, description: 'Invalid params', schema: errorSchema }],
    },
    POST: {
      summary: 'Create a reservation',
      description:
        'Optional startAt places the reservation at creation; without it the reservation lands in the backlog. Exactly one of targetId/targetText is required. Mocked in SD-51.',
      tags: ['Reservations'],
      requestBody: { schema: createReservationSchema },
      responses: [{ status: 201, description: 'Created', schema: createdResponseSchema }],
      errors: [
        { status: 400, description: 'Invalid input', schema: errorSchema },
        { status: 404, description: 'Subject or target not in scope', schema: errorSchema },
        { status: 422, description: 'target_invalid — none or both of targetId/targetText', schema: errorSchema },
      ],
    },
  },
}
