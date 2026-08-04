import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { errorSchema } from '../../../../data/validators'
import { reservationDetailFixture } from '../../../../data/fixtures'

export const metadata = {
  PUT: { requireAuth: true, requireFeatures: ['reservations.manage_reservations'] },
}

export async function PUT() {
  return NextResponse.json({ id: reservationDetailFixture.id, status: 'cancelled' })
}

const cancelResponseSchema = z.object({ id: z.uuid(), status: z.literal('cancelled') })

export const openApi: OpenApiRouteDoc = {
  summary: 'Cancel a reservation',
  methods: {
    PUT: {
      summary: 'Cancel a reservation',
      description: 'Alias of change-status to cancelled — same state machine.',
      tags: ['Reservations'],
      responses: [{ status: 200, description: 'Cancelled', schema: cancelResponseSchema }],
      errors: [
        { status: 404, description: 'Not found in scope', schema: errorSchema },
        { status: 409, description: 'concurrent_modification', schema: errorSchema },
        { status: 422, description: 'invalid_transition — already closed', schema: errorSchema },
      ],
    },
  },
}
