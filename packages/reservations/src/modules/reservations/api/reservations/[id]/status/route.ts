import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  changeReservationStatusSchema,
  errorSchema,
  reservationStatusSchema,
} from '../../../../data/validators'
import { reservationDetailFixture } from '../../../../data/fixtures'

export const metadata = {
  PUT: { requireAuth: true, requireFeatures: ['reservations.manage_reservations'] },
}

export async function PUT() {
  return NextResponse.json({ id: reservationDetailFixture.id, status: 'active' })
}

const statusResponseSchema = z.object({ id: z.uuid(), status: reservationStatusSchema })

export const openApi: OpenApiRouteDoc = {
  summary: 'Change reservation status',
  methods: {
    PUT: {
      summary: 'Transition the reservation status',
      description:
        'planned→active, planned|active→cancelled, active→done, done→active (correction); cancelled is terminal.',
      tags: ['Reservations'],
      requestBody: { schema: changeReservationStatusSchema },
      responses: [{ status: 200, description: 'Status changed', schema: statusResponseSchema }],
      errors: [
        { status: 400, description: 'Invalid input', schema: errorSchema },
        { status: 404, description: 'Not found in scope', schema: errorSchema },
        { status: 409, description: 'concurrent_modification', schema: errorSchema },
        { status: 422, description: 'invalid_transition', schema: errorSchema },
      ],
    },
  },
}
