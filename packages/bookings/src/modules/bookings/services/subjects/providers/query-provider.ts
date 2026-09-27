import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { SortDir } from '@open-mercato/shared/lib/query/types'
import type { ProviderRecord, SubjectKind, SubjectProvider } from './provider'

type RegistryProviderDefinition = {
  key: string
  kind: SubjectKind
  labelKey: string
  entityId: string
  nameField: string
  createCommand: string
  createFeature: string
  createInput: (name: string) => Record<string, unknown>
  createdId: (result: unknown) => string | null
  cardHref: (recordId: string) => string
}

type Row = Record<string, unknown>

const DESCRIBE_CHUNK = 100

export function defineRegistryProvider(definition: RegistryProviderDefinition): SubjectProvider {
  const fields = ['id', definition.nameField, 'is_active']

  const toRecord = (row: Row): ProviderRecord => ({
    recordId: String(row.id),
    name: String(row[definition.nameField] ?? ''),
    isActive: row.is_active !== false,
  })

  return {
    key: definition.key,
    kind: definition.kind,
    labelKey: definition.labelKey,
    createFeature: definition.createFeature,

    async createRecord(ctx, scope, values) {
      const commandBus = ctx.container.resolve('commandBus') as CommandBus
      const { result } = await commandBus.execute(definition.createCommand, {
        input: { ...scope, ...definition.createInput(values.name) },
        ctx,
      })
      const recordId = definition.createdId(result)
      if (!recordId) throw new Error(`${definition.createCommand} returned no record id`)
      return recordId
    },

    async describe({ queryEngine, scope }, recordIds) {
      const found = new Map<string, ProviderRecord>()
      const unique = [...new Set(recordIds)]
      for (let start = 0; start < unique.length; start += DESCRIBE_CHUNK) {
        const chunk = unique.slice(start, start + DESCRIBE_CHUNK)
        const result = await queryEngine.query<Row>(definition.entityId as never, {
          fields,
          filters: { id: { $in: chunk } },
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
          page: { page: 1, pageSize: chunk.length },
        })
        for (const row of result.items ?? []) found.set(String(row.id), toRecord(row))
      }
      return found
    },

    async listCandidates({ queryEngine, scope }, query) {
      const filters: Record<string, unknown> = {}
      if (query.excludeIds.length > 0) filters.id = { $nin: [...query.excludeIds] }
      const term = query.search?.trim()
      if (term) filters[definition.nameField] = { $ilike: `%${escapeLikePattern(term)}%` }
      const result = await queryEngine.query<Row>(definition.entityId as never, {
        fields,
        filters,
        sort: [{ field: definition.nameField, dir: SortDir.Asc }],
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        page: { page: query.page, pageSize: query.pageSize },
      })
      return { items: (result.items ?? []).map(toRecord), total: result.total ?? 0 }
    },

    cardHref: definition.cardHref,

    async unavailability() {
      return null
    },
  }
}
