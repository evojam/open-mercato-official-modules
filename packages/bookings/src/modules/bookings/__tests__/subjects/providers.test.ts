import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import type { QueryEngine } from '@open-mercato/shared/lib/query/types'
import { resourcesSubjectProvider, staffSubjectProvider } from '../../services/subjects/providers/builtin.providers'
import type { SubjectProvider } from '../../services/subjects/providers/provider'
import { getSubjectProvider, listSubjectProviders, registerSubjectProvider } from '../../services/subjects/providers/registry'

const SCOPE = { tenantId: 'tenant-1', organizationId: 'org-1' }

function fakeQueryEngine(items: Record<string, unknown>[]) {
  return { query: jest.fn(async () => ({ items, total: items.length, page: 1, pageSize: 20 })) }
}

describe('subject provider registry', () => {
  it('registers, finds and unregisters a provider by key', () => {
    const custom = { ...resourcesSubjectProvider, key: 'fleet' } as SubjectProvider
    const unregister = registerSubjectProvider(custom)

    expect(getSubjectProvider('fleet')).toBe(custom)
    expect(listSubjectProviders()).toContain(custom)

    unregister()
    expect(getSubjectProvider('fleet')).toBeUndefined()
  })
})

describe('built-in registry providers', () => {
  it('reads resources by name and staff by display name', async () => {
    const resources = fakeQueryEngine([{ id: 'r1', name: 'Excavator', is_active: true }])
    const staff = fakeQueryEngine([{ id: 's1', display_name: 'Anna', is_active: false }])

    const resourceRecords = await resourcesSubjectProvider.describe({ queryEngine: resources as unknown as QueryEngine, scope: SCOPE }, ['r1'])
    const staffRecords = await staffSubjectProvider.describe({ queryEngine: staff as unknown as QueryEngine, scope: SCOPE }, ['s1'])

    expect(resourceRecords.get('r1')).toEqual({ recordId: 'r1', name: 'Excavator', isActive: true })
    expect(staffRecords.get('s1')).toEqual({ recordId: 's1', name: 'Anna', isActive: false })
    expect(resources.query).toHaveBeenCalledWith(
      'resources:resources_resource',
      expect.objectContaining({ filters: { id: { $in: ['r1'] } }, ...SCOPE })
    )
  })

  it('lists candidates without the records that are already subjects', async () => {
    const engine = fakeQueryEngine([{ id: 'r2', name: 'Crane' }])

    const page = await resourcesSubjectProvider.listCandidates(
      { queryEngine: engine as unknown as QueryEngine, scope: SCOPE },
      { search: 'cra', excludeIds: ['r1'], page: 1, pageSize: 20 }
    )

    expect(page.items).toEqual([{ recordId: 'r2', name: 'Crane', isActive: true }])
    expect(engine.query).toHaveBeenCalledWith(
      'resources:resources_resource',
      expect.objectContaining({ filters: { id: { $nin: ['r1'] }, name: { $ilike: '%cra%' } } })
    )
  })

  it('creates the record through the owning module command and returns its id', async () => {
    const execute = jest.fn(async () => ({ result: { memberId: 'member-7' } }))
    const ctx = { container: { resolve: () => ({ execute }) } } as unknown as CommandRuntimeContext

    const recordId = await staffSubjectProvider.createRecord(ctx, SCOPE, { name: 'Marek' })

    expect(recordId).toBe('member-7')
    expect(execute).toHaveBeenCalledWith('staff.team-members.create', { input: { ...SCOPE, displayName: 'Marek' }, ctx })
  })

  it('answers "unknown" for unavailability until planner exposes it', async () => {
    const engine = fakeQueryEngine([])

    await expect(
      staffSubjectProvider.unavailability({ queryEngine: engine as unknown as QueryEngine, scope: SCOPE }, ['s1'], {
        from: new Date('2026-10-01T00:00:00Z'),
        to: new Date('2026-10-02T00:00:00Z'),
      })
    ).resolves.toBeNull()
  })
})
