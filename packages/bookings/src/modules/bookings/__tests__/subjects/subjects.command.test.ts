import { UniqueConstraintViolationException } from '@mikro-orm/core'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { addSubjectCommand, updateSubjectCommand } from '../../commands/subjects/subjects.command'
import { BookingSubject, BookingSubjectCategory, BookingsSettings } from '../../data/entities'
import type { SubjectProvider } from '../../services/subjects/providers/provider'
import { registerSubjectProvider } from '../../services/subjects/providers/registry'

jest.mock('@open-mercato/shared/lib/i18n/server', () => ({
  resolveTranslations: async () => ({ translate: (_key: string, fallback?: string) => fallback ?? _key }),
}))

const TENANT = '6f1c2b0e-1c7a-4a52-9d3e-5b8f0d1a2c3d'
const ORG = '0b9e8d7c-6a5b-4c3d-8e2f-1a0b9c8d7e6f'
const SCOPE = { tenantId: TENANT, organizationId: ORG }
const CATEGORY_ID = '11111111-1111-4111-8111-111111111111'

const provider = {
  key: 'test-registry',
  kind: 'resource',
  labelKey: 'test',
  createFeature: 'test.manage',
  createRecord: jest.fn(async () => 'new-record'),
  describe: jest.fn(async (_read: unknown, ids: readonly string[]) =>
    new Map(ids.filter((id) => id === 'known').map((id) => [id, { recordId: id, name: 'Excavator 1', isActive: true }]))
  ),
  listCandidates: jest.fn(),
  cardHref: (id: string) => `/card/${id}`,
  unavailability: jest.fn(async () => null),
} as unknown as SubjectProvider

registerSubjectProvider(provider)

type Store = {
  settings: BookingsSettings | null
  subjects: BookingSubject[]
  categoryExists?: boolean
  allowed?: boolean
  flushError?: unknown
}

function fakeContainer(store: Store) {
  const em = {
    fork: () => em,
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === BookingsSettings) return store.settings
      if (entity === BookingSubjectCategory) {
        return store.categoryExists ? Object.assign(new BookingSubjectCategory(), { id: where.id }) : null
      }
      if (where.providerKey) {
        return (
          store.subjects.find(
            (subject) =>
              subject.providerKey === where.providerKey && subject.providerRecordId === where.providerRecordId && subject.deletedAt
          ) ?? null
        )
      }
      return store.subjects.find((subject) => subject.id === where.id && (where.deletedAt === undefined || !subject.deletedAt)) ?? null
    }),
    create: jest.fn((_entity: unknown, data: Partial<BookingSubject>) =>
      Object.assign(new BookingSubject(), { id: '00000000-0000-4000-8000-000000000042', ...data })
    ),
    persist: jest.fn((subject: BookingSubject) => {
      store.subjects.push(subject)
    }),
    flush: jest.fn(async () => {
      if (store.flushError) throw store.flushError
    }),
    getReference: jest.fn((_entity: unknown, id: string) => Object.assign(new BookingSubjectCategory(), { id })),
  }
  const services: Record<string, unknown> = {
    em,
    queryEngine: {},
    rbacService: { userHasAllFeatures: jest.fn(async () => store.allowed !== false) },
  }
  return { resolve: (name: string) => services[name] }
}

function ctxFor(store: Store): CommandRuntimeContext {
  return {
    container: fakeContainer(store),
    auth: { sub: 'user-1', tenantId: TENANT, orgId: ORG },
    organizationScope: null,
    selectedOrganizationId: ORG,
    organizationIds: [ORG],
  } as unknown as CommandRuntimeContext
}

function settings(): BookingsSettings {
  return Object.assign(new BookingsSettings(), { ...SCOPE, timeZone: 'Europe/Warsaw' })
}

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (err: unknown) => err)
  if (!isCrudHttpError(error)) throw new Error(`expected a CrudHttpError, got ${String(error)}`)
  return error
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('bookings.subjects.add — existing record', () => {
  it("attaches a provider record with its name and the organization's zone", async () => {
    const store: Store = { settings: settings(), subjects: [] }

    await addSubjectCommand.execute(
      { ...SCOPE, mode: 'existing', providerKey: 'test-registry', providerRecordId: 'known' } as never,
      ctxFor(store)
    )

    expect(store.subjects[0]).toMatchObject({
      providerKey: 'test-registry',
      providerRecordId: 'known',
      name: 'Excavator 1',
      timeZone: 'Europe/Warsaw',
    })
    expect(provider.createRecord).not.toHaveBeenCalled()
  })

  it('brings back the deleted row of the same record instead of creating a second one', async () => {
    const removed = Object.assign(new BookingSubject(), {
      id: '00000000-0000-4000-8000-000000000009',
      ...SCOPE,
      providerKey: 'test-registry',
      providerRecordId: 'known',
      name: 'Old name',
      timeZone: 'Europe/Lisbon',
      isActive: false,
      deletedAt: new Date('2026-01-01T00:00:00Z'),
    })
    const store: Store = { settings: settings(), subjects: [removed] }

    const result = await addSubjectCommand.execute(
      { ...SCOPE, mode: 'existing', providerKey: 'test-registry', providerRecordId: 'known' } as never,
      ctxFor(store)
    )

    expect(result.id).toBe(removed.id)
    expect(store.subjects).toHaveLength(1)
    expect(removed).toMatchObject({ deletedAt: null, isActive: true, name: 'Excavator 1', timeZone: 'Europe/Lisbon' })
  })

  it('refuses a record the provider does not know', async () => {
    const error = await rejection(
      addSubjectCommand.execute(
        { ...SCOPE, mode: 'existing', providerKey: 'test-registry', providerRecordId: 'ghost' } as never,
        ctxFor({ settings: settings(), subjects: [] })
      )
    )

    expect(error.status).toBe(404)
    expect(error.body).toMatchObject({ code: 'provider_record_not_found' })
  })

  it('answers 409 when the record is already a subject', async () => {
    const store: Store = { settings: settings(), subjects: [], flushError: new UniqueConstraintViolationException(new Error('dup')) }

    const error = await rejection(
      addSubjectCommand.execute(
        { ...SCOPE, mode: 'existing', providerKey: 'test-registry', providerRecordId: 'known' } as never,
        ctxFor(store)
      )
    )

    expect(error.status).toBe(409)
    expect(error.body).toMatchObject({ code: 'subject_already_added' })
  })
})

describe('bookings.subjects.add — new record', () => {
  it('creates the record at the provider first, then attaches it', async () => {
    const store: Store = { settings: settings(), subjects: [] }

    await addSubjectCommand.execute({ ...SCOPE, mode: 'new', providerKey: 'test-registry', name: 'Crane 2' } as never, ctxFor(store))

    expect(provider.createRecord).toHaveBeenCalledWith(expect.anything(), SCOPE, { name: 'Crane 2' })
    expect(store.subjects[0]).toMatchObject({ providerRecordId: 'new-record', name: 'Crane 2' })
  })

  it("refuses when the user may not write to the provider's registry", async () => {
    const error = await rejection(
      addSubjectCommand.execute(
        { ...SCOPE, mode: 'new', providerKey: 'test-registry', name: 'Crane 2' } as never,
        ctxFor({ settings: settings(), subjects: [], allowed: false })
      )
    )

    expect(error.status).toBe(403)
    expect(provider.createRecord).not.toHaveBeenCalled()
  })

  it('reports the created record id when attaching it fails, so the screen can attach it instead of creating another', async () => {
    const store: Store = { settings: settings(), subjects: [], flushError: new Error('db down') }

    const error = await rejection(
      addSubjectCommand.execute({ ...SCOPE, mode: 'new', providerKey: 'test-registry', name: 'Crane 2' } as never, ctxFor(store))
    )

    expect(error.body).toMatchObject({
      code: 'provider_record_orphaned',
      details: { providerKey: 'test-registry', providerRecordId: 'new-record' },
    })
  })
})

describe('bookings.subjects.add — preconditions', () => {
  it('refuses before the organization has chosen its time zone', async () => {
    const error = await rejection(
      addSubjectCommand.execute(
        { ...SCOPE, mode: 'existing', providerKey: 'test-registry', providerRecordId: 'known' } as never,
        ctxFor({ settings: null, subjects: [] })
      )
    )

    expect(error.body).toMatchObject({ code: 'settings_required' })
  })

  it('refuses an unknown provider and a category from elsewhere', async () => {
    const unknownProvider = await rejection(
      addSubjectCommand.execute(
        { ...SCOPE, mode: 'existing', providerKey: 'nope', providerRecordId: 'known' } as never,
        ctxFor({ settings: settings(), subjects: [] })
      )
    )
    const foreignCategory = await rejection(
      addSubjectCommand.execute(
        { ...SCOPE, mode: 'existing', providerKey: 'test-registry', providerRecordId: 'known', categoryId: CATEGORY_ID } as never,
        ctxFor({ settings: settings(), subjects: [], categoryExists: false })
      )
    )

    expect(unknownProvider.body).toMatchObject({ code: 'unknown_provider' })
    expect(foreignCategory.body).toMatchObject({ code: 'unknown_category' })
  })
})

describe('bookings.subjects.update', () => {
  function subject(): BookingSubject {
    return Object.assign(new BookingSubject(), {
      id: '00000000-0000-4000-8000-000000000001',
      ...SCOPE,
      providerKey: 'test-registry',
      providerRecordId: 'known',
      name: 'Excavator 1',
      timeZone: 'Europe/Warsaw',
      isActive: true,
      category: null,
      deletedAt: null,
    })
  }

  it('changes category, zone and whether the subject is in use', async () => {
    const existing = subject()
    const store: Store = { settings: settings(), subjects: [existing], categoryExists: true }

    await updateSubjectCommand.execute(
      { ...SCOPE, id: existing.id, categoryId: CATEGORY_ID, timeZone: 'Europe/Lisbon', isActive: false } as never,
      ctxFor(store)
    )

    expect(existing.category?.id).toBe(CATEGORY_ID)
    expect(existing).toMatchObject({ timeZone: 'Europe/Lisbon', isActive: false })
  })

  it('clears the category with null', async () => {
    const existing = Object.assign(subject(), { category: Object.assign(new BookingSubjectCategory(), { id: CATEGORY_ID }) })

    await updateSubjectCommand.execute({ ...SCOPE, id: existing.id, categoryId: null } as never, ctxFor({ settings: settings(), subjects: [existing] }))

    expect(existing.category).toBeNull()
  })

  it('undoes an update by restoring the fields from before', async () => {
    const existing = Object.assign(subject(), { timeZone: 'Europe/Lisbon', isActive: false })
    const before = { id: existing.id, ...SCOPE, categoryId: CATEGORY_ID, timeZone: 'Europe/Warsaw', isActive: true, deletedAt: null }

    await updateSubjectCommand.undo!({
      input: {} as never,
      ctx: ctxFor({ settings: settings(), subjects: [existing] }),
      logEntry: { commandPayload: { undo: { before } } } as never,
    })

    expect(existing).toMatchObject({ timeZone: 'Europe/Warsaw', isActive: true })
    expect(existing.category?.id).toBe(CATEGORY_ID)
  })
})
