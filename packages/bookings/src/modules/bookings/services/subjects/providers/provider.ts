import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import type { QueryEngine } from '@open-mercato/shared/lib/query/types'
import type { BookingsScope } from '../../settings/effective-settings'

export type SubjectKind = 'person' | 'resource'

export type ProviderRecord = {
  recordId: string
  name: string
  isActive: boolean
}

export type ProviderCandidatePage = {
  items: ProviderRecord[]
  total: number
}

export type ProviderUnavailabilityWindow = {
  recordId: string
  from: Date
  to: Date
  reason: string | null
}

export type SubjectProviderReadContext = {
  queryEngine: QueryEngine
  scope: BookingsScope
}

export type SubjectProvider = {
  readonly key: string
  readonly kind: SubjectKind
  readonly labelKey: string
  readonly createFeature: string
  createRecord(ctx: CommandRuntimeContext, scope: BookingsScope, values: { name: string }): Promise<string>
  describe(read: SubjectProviderReadContext, recordIds: readonly string[]): Promise<Map<string, ProviderRecord>>
  listCandidates(
    read: SubjectProviderReadContext,
    query: { search?: string; excludeIds: readonly string[]; page: number; pageSize: number }
  ): Promise<ProviderCandidatePage>
  cardHref(recordId: string): string
  unavailability(
    read: SubjectProviderReadContext,
    recordIds: readonly string[],
    range: { from: Date; to: Date }
  ): Promise<ProviderUnavailabilityWindow[] | null>
}
