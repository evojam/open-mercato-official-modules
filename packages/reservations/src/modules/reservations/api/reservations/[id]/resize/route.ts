import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { errorSchema, placementSchema, resizeReservationSchema } from '../../../../data/validators'
import { reservationDetailFixture } from '../../../../data/fixtures'

export const metadata = {
  PUT: { requireAuth: true, requireFeatures: ['reservations.manage_reservations'] },
}

export async function PUT() {
  return NextResponse.json({
    id: reservationDetailFixture.id,
    durationWorkingDays: reservationDetailFixture.durationWorkingDays,
    placement: reservationDetailFixture.placement,
  })
}

const resizeResponseSchema = z.object({
  id: z.uuid(),
  durationWorkingDays: z.number(),
  placement: placementSchema.nullable(),
})

export const openApi: OpenApiRouteDoc = {
  summary: 'Resize a reservation',
  methods: {
    PUT: {
      summary: 'Change reservation duration',
      description: 'Duration is the master; endAt is recomputed when placed. Mocked in SD-51.',
      tags: ['Reservations'],
      requestBody: { schema: resizeReservationSchema },
      responses: [{ status: 200, description: 'Resized', schema: resizeResponseSchema }],
      errors: [
        { status: 400, description: 'Invalid input', schema: errorSchema },
        { status: 404, description: 'Not found in scope', schema: errorSchema },
        { status: 409, description: 'concurrent_modification', schema: errorSchema },
        { status: 422, description: 'invalid_state — closed reservation', schema: errorSchema },
      ],
    },
  },
}
