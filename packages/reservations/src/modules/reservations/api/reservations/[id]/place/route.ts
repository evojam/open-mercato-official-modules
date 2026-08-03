import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  errorSchema,
  placeReservationSchema,
  placementSchema,
  reservationStatusSchema,
} from '../../../../data/validators'
import { reservationDetailFixture } from '../../../../data/fixtures'

export const metadata = {
  PUT: { requireAuth: true, requireFeatures: ['reservations.manage_reservations'] },
}

export async function PUT() {
  return NextResponse.json({
    id: reservationDetailFixture.id,
    placement: reservationDetailFixture.placement,
    status: reservationDetailFixture.status,
  })
}

const placeResponseSchema = z.object({
  id: z.uuid(),
  placement: placementSchema,
  status: reservationStatusSchema,
})

export const openApi: OpenApiRouteDoc = {
  summary: 'Place a reservation',
  methods: {
    PUT: {
      summary: 'Place a reservation on the axis',
      description:
        'A placement causing a schedule conflict is NOT an error — detection is post-commit. Mocked in SD-51.',
      tags: ['Reservations'],
      requestBody: { schema: placeReservationSchema },
      responses: [{ status: 200, description: 'Placed', schema: placeResponseSchema }],
      errors: [
        { status: 400, description: 'Invalid input', schema: errorSchema },
        { status: 404, description: 'Not found in scope', schema: errorSchema },
        { status: 409, description: 'concurrent_modification', schema: errorSchema },
        { status: 422, description: 'invalid_state — placement on done/cancelled', schema: errorSchema },
      ],
    },
  },
}
