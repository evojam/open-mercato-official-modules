import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { createTargetSchema, errorSchema, targetDtoSchema } from '../../data/validators'
import { CREATED_TARGET_ID, targetFixtures } from '../../data/fixtures'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['reservations.view'] },
  POST: { requireAuth: true, requireFeatures: ['reservations.manage_reservations'] },
}

export async function GET() {
  return NextResponse.json({ items: targetFixtures, total: targetFixtures.length })
}

export async function POST() {
  return NextResponse.json({ id: CREATED_TARGET_ID }, { status: 201 })
}

const listResponseSchema = z.object({ items: z.array(targetDtoSchema), total: z.number().int() })
const createdResponseSchema = z.object({ id: z.uuid() })

export const openApi: OpenApiRouteDoc = {
  summary: 'Reservation targets',
  methods: {
    GET: {
      summary: 'List targets',
      description: 'Query: page?, pageSize?. Mocked in SD-51.',
      tags: ['Reservations'],
      responses: [{ status: 200, description: 'Paged targets', schema: listResponseSchema }],
      errors: [{ status: 400, description: 'Invalid params', schema: errorSchema }],
    },
    POST: {
      summary: 'Create a target',
      tags: ['Reservations'],
      requestBody: { schema: createTargetSchema },
      responses: [{ status: 201, description: 'Created', schema: createdResponseSchema }],
      errors: [
        { status: 400, description: 'Invalid input', schema: errorSchema },
        { status: 422, description: 'invalid_window', schema: errorSchema },
      ],
    },
  },
}
