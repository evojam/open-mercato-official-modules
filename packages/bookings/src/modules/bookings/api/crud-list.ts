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
  const ids = [query.id ?? '', ...(query.ids ?? '').split(',')]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
  if (ids.length > 0) filters.id = { $in: ids }
  const term = query.search?.trim()
  if (term) filters.name = { $ilike: `%${escapeLikePattern(term)}%` }
  return filters
}
