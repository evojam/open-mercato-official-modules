import { z } from 'zod'
import { targetWindowSchema } from './dto.schema'

export const createTargetSchema = z.object({
  name: z.string().trim().min(1).max(200),
  window: targetWindowSchema.optional(),
  addressText: z.string().optional(),
})
export type CreateTargetInput = z.output<typeof createTargetSchema>

export const updateTargetSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  window: targetWindowSchema.nullable().optional(),
  addressText: z.string().nullable().optional(),
})
export type UpdateTargetInput = z.output<typeof updateTargetSchema>

export const targetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})
export type TargetListQuery = z.output<typeof targetListQuerySchema>
