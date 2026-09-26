import { z } from 'zod'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'

export const crudListQuerySchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    id: z.string().uuid().optional(),
    ids: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough()

export type CrudListQuery = z.infer<typeof crudListQuerySchema>

export function nameAndIdFilters(query: CrudListQuery): Record<string, unknown> {
  const filters: Record<string, unknown> = {}
  if (query.id) filters.id = { $in: [query.id] }
  const term = query.search?.trim()
  if (term) filters.name = { $ilike: `%${escapeLikePattern(term)}%` }
  return filters
}

export function sortItemsByName(payload: { items?: unknown[] }): void {
  if (!Array.isArray(payload.items)) return
  payload.items.sort((a, b) =>
    String((a as { name?: unknown }).name ?? '').localeCompare(String((b as { name?: unknown }).name ?? ''))
  )
}
