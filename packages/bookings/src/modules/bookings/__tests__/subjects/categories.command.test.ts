import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { TARGET_PALETTE } from '../../../../lib/timeline/palette'
import { bookingCategoryCommands } from '../../commands/subjects/categories.command'
import { BookingConflictPolicyException, BookingSubject, BookingSubjectCategory } from '../../data/entities'

const TENANT = '6f1c2b0e-1c7a-4a52-9d3e-5b8f0d1a2c3d'
const ORG = '0b9e8d7c-6a5b-4c3d-8e2f-1a0b9c8d7e6f'
const SCOPE = { tenantId: TENANT, organizationId: ORG }
const CATEGORY_ID = '00000000-0000-4000-8000-000000000001'

jest.mock('@open-mercato/shared/lib/i18n/server', () => ({
  resolveTranslations: async () => ({ translate: (_key: string, fallback?: string) => fallback ?? _key }),
}))

type Usage = { subjects?: number; exceptions?: number }

function category(values: Partial<BookingSubjectCategory> = {}): BookingSubjectCategory {
  return Object.assign(new BookingSubjectCategory(), { id: CATEGORY_ID, ...SCOPE, name: 'Excavators', deletedAt: null, ...values })
}

function fakeEm(categories: BookingSubjectCategory[], usage: Usage = {}) {
  const em = {
    fork: () => em,
    findOne: jest.fn(async () => categories.find((row) => !row.deletedAt) ?? null),
    find: jest.fn(async () => categories.filter((row) => !row.deletedAt)),
    count: jest.fn(async (entity: unknown) => {
      if (entity === BookingSubject) return usage.subjects ?? 0
      if (entity === BookingConflictPolicyException) return usage.exceptions ?? 0
      return 0
    }),
    create: jest.fn((_entity: unknown, data: Partial<BookingSubjectCategory>) =>
      Object.assign(new BookingSubjectCategory(), { id: '00000000-0000-4000-8000-000000000099', ...data })
    ),
    persist: jest.fn((row: BookingSubjectCategory) => {
      categories.push(row)
    }),
    flush: jest.fn(async () => undefined),
  }
  return em
}

function ctxFor(em: unknown): CommandRuntimeContext {
  return {
    container: { resolve: () => em },
    auth: { sub: 'user-1', tenantId: TENANT, orgId: ORG },
    organizationScope: null,
    selectedOrganizationId: ORG,
    organizationIds: [ORG],
  } as unknown as CommandRuntimeContext
}

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (err: unknown) => err)
  if (!isCrudHttpError(error)) throw new Error(`expected a CrudHttpError, got ${String(error)}`)
  return error
}

describe('bookings.categories', () => {
  it('gives a new category the next free palette color and no icon when none is chosen', async () => {
    const categories = [category({ color: TARGET_PALETTE[0] })]

    await bookingCategoryCommands.create.execute({ ...SCOPE, name: 'Crews' }, ctxFor(fakeEm(categories)))

    expect(categories[1]).toMatchObject({ name: 'Crews', color: TARGET_PALETTE[1], icon: null })
  })

  it.each([
    ['a subject', { subjects: 1 }],
    ['a conflict policy exception', { exceptions: 1 }],
  ])('refuses to delete a category still used by %s', async (_label, usage) => {
    const existing = category()

    const error = await rejection(bookingCategoryCommands.delete.execute({ id: existing.id }, ctxFor(fakeEm([existing], usage))))

    expect(error.status).toBe(409)
    expect(error.body).toMatchObject({ code: 'category_in_use' })
    expect(existing.deletedAt).toBeNull()
  })

  it('deletes an unused category', async () => {
    const existing = category()

    await bookingCategoryCommands.delete.execute({ id: existing.id }, ctxFor(fakeEm([existing])))

    expect(existing.deletedAt).toBeInstanceOf(Date)
  })
})
