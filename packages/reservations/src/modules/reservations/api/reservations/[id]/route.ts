import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  errorSchema,
  reservationDetailDtoSchema,
  updateReservationSchema,
} from '../../../data/validators'
import { reservationDetailFixture } from '../../../data/fixtures'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['reservations.view'] },
  PUT: { requireAuth: true, requireFeatures: ['reservations.manage_reservations'] },
}

export async function GET() {
  return NextResponse.json(reservationDetailFixture)
}

export async function PUT() {
  return NextResponse.json({ id: reservationDetailFixture.id })
}

const updatedResponseSchema = z.object({ id: z.uuid() })

export const openApi: OpenApiRouteDoc = {
  summary: 'Reservation detail',
  methods: {
    GET: {
      summary: 'Get a reservation',
      tags: ['Reservations'],
      responses: [{ status: 200, description: 'Reservation detail', schema: reservationDetailDtoSchema }],
      errors: [{ status: 404, description: 'Not found in scope', schema: errorSchema }],
    },
    PUT: {
      summary: 'Descriptive update',
      description: 'Target, latestStart, note. Placement changes go through place/move/resize. Mocked in SD-51.',
      tags: ['Reservations'],
      requestBody: { schema: updateReservationSchema },
      responses: [{ status: 200, description: 'Updated', schema: updatedResponseSchema }],
      errors: [
        { status: 400, description: 'Invalid input', schema: errorSchema },
        { status: 404, description: 'Not found in scope', schema: errorSchema },
        { status: 409, description: 'concurrent_modification', schema: errorSchema },
        { status: 422, description: 'target_invalid', schema: errorSchema },
      ],
    },
  },
}
