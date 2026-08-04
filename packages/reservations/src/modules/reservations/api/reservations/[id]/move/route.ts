import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { errorSchema, moveReservationSchema, placementSchema } from '../../../../data/validators'
import { reservationDetailFixture } from '../../../../data/fixtures'

export const metadata = {
  PUT: { requireAuth: true, requireFeatures: ['reservations.manage_reservations'] },
}

export async function PUT() {
  return NextResponse.json({
    id: reservationDetailFixture.id,
    placement: reservationDetailFixture.placement,
  })
}

const moveResponseSchema = z.object({ id: z.uuid(), placement: placementSchema })

export const openApi: OpenApiRouteDoc = {
  summary: 'Move a reservation',
  methods: {
    PUT: {
      summary: 'Move a placed reservation',
      tags: ['Reservations'],
      requestBody: { schema: moveReservationSchema },
      responses: [{ status: 200, description: 'Moved', schema: moveResponseSchema }],
      errors: [
        { status: 400, description: 'Invalid input', schema: errorSchema },
        { status: 404, description: 'Not found in scope', schema: errorSchema },
        { status: 409, description: 'concurrent_modification', schema: errorSchema },
        { status: 422, description: 'invalid_state — unplaced or closed', schema: errorSchema },
      ],
    },
  },
}
