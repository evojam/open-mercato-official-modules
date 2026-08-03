import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { errorSchema, targetDtoSchema, updateTargetSchema } from '../../../data/validators'
import { targetFixtures } from '../../../data/fixtures'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['reservations.view'] },
  PUT: { requireAuth: true, requireFeatures: ['reservations.manage_reservations'] },
  DELETE: { requireAuth: true, requireFeatures: ['reservations.manage_reservations'] },
}

export async function GET() {
  return NextResponse.json(targetFixtures[0])
}

export async function PUT() {
  return NextResponse.json({ id: targetFixtures[0].id })
}

export async function DELETE() {
  return NextResponse.json({ deleted: true })
}

const updatedResponseSchema = z.object({ id: z.uuid() })
const deletedResponseSchema = z.object({ deleted: z.literal(true) })

export const openApi: OpenApiRouteDoc = {
  summary: 'Reservation target detail',
  methods: {
    GET: {
      summary: 'Get a target',
      tags: ['Reservations'],
      responses: [{ status: 200, description: 'Target', schema: targetDtoSchema }],
      errors: [{ status: 404, description: 'Not found in scope', schema: errorSchema }],
    },
    PUT: {
      summary: 'Update a target',
      tags: ['Reservations'],
      requestBody: { schema: updateTargetSchema },
      responses: [{ status: 200, description: 'Updated', schema: updatedResponseSchema }],
      errors: [
        { status: 400, description: 'Invalid input', schema: errorSchema },
        { status: 404, description: 'Not found in scope', schema: errorSchema },
        { status: 409, description: 'concurrent_modification', schema: errorSchema },
        { status: 422, description: 'invalid_window', schema: errorSchema },
      ],
    },
    DELETE: {
      summary: 'Delete a target (soft)',
      tags: ['Reservations'],
      responses: [{ status: 200, description: 'Deleted', schema: deletedResponseSchema }],
      errors: [
        { status: 404, description: 'Not found in scope', schema: errorSchema },
        { status: 409, description: 'in_use — has open reservations', schema: errorSchema },
      ],
    },
  },
}
