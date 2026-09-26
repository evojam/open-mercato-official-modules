import { UniqueConstraintViolationException } from '@mikro-orm/core'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { TARGET_PALETTE } from '../../../../lib/timeline/palette'
import { bookingTargetCommands } from '../../commands/targets/targets.command'
import { BookingTarget, BookingsSettings } from '../../data/entities'

const TENANT = '6f1c2b0e-1c7a-4a52-9d3e-5b8f0d1a2c3d'
const ORG = '0b9e8d7c-6a5b-4c3d-8e2f-1a0b9c8d7e6f'
const OTHER_ORG = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const SCOPE = { tenantId: TENANT, organizationId: ORG }

jest.mock('@open-mercato/shared/lib/i18n/server', () => ({
  resolveTranslations: async () => ({ translate: (_key: string, fallback?: string) => fallback ?? _key }),
}))

type Store = { settings: BookingsSettings | null; targets: BookingTarget[]; openBookings?: number }

let sequence = 0

function target(values: Partial<BookingTarget>): BookingTarget {
  sequence += 1
  return Object.assign(new BookingTarget(), {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    ...SCOPE,
    name: 'Site',
    timeZone: 'Europe/Warsaw',
    color: TARGET_PALETTE[0],
    deletedAt: null,
    ...values,
  })
}

function matches(row: BookingTarget, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    const actual = (row as unknown as Record<string, unknown>)[key]
    return value === null ? actual == null : actual === value
  })
}

function fakeEm(store: Store, flushError?: unknown) {
  const em = {
    fork: () => em,
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === BookingsSettings) return store.settings
      return store.targets.find((row) => matches(row, where)) ?? null
    }),
    find: jest.fn(async (_entity: unknown, where: Record<string, unknown>) => store.targets.filter((row) => matches(row, where))),
    count: jest.fn(async () => store.openBookings ?? 0),
    create: jest.fn((_entity: unknown, data: Partial<BookingTarget>) => target(data)),
    persist: jest.fn((row: BookingTarget) => {
      store.targets.push(row)
    }),
    flush: jest.fn(async () => {
      if (flushError) throw flushError
    }),
  }
  return em
}

function ctxFor(em: unknown, organizationId = ORG): CommandRuntimeContext {
  return {
    container: { resolve: () => em },
    auth: { sub: 'user-1', tenantId: TENANT, orgId: organizationId },
    organizationScope: null,
    selectedOrganizationId: organizationId,
    organizationIds: [organizationId],
  } as unknown as CommandRuntimeContext
}

function settings(): BookingsSettings {
  return Object.assign(new BookingsSettings(), { ...SCOPE, timeZone: 'Europe/Lisbon' })
}

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (err: unknown) => err)
  if (!isCrudHttpError(error)) throw new Error(`expected a CrudHttpError, got ${String(error)}`)
  return error
}

describe('bookings.targets.create', () => {
  it('refuses to create a target before the organization has chosen its time zone', async () => {
    const em = fakeEm({ settings: null, targets: [] })

    const error = await rejection(bookingTargetCommands.create.execute({ ...SCOPE, name: 'Mokotów' }, ctxFor(em)))

    expect(error.status).toBe(409)
    expect(error.body).toMatchObject({ code: 'settings_required' })
  })

  it("takes the organization's zone and the next free palette color when none is given", async () => {
    const store: Store = { settings: settings(), targets: [target({ color: TARGET_PALETTE[0] })] }

    await bookingTargetCommands.create.execute({ ...SCOPE, name: 'Mokotów' }, ctxFor(fakeEm(store)))

    expect(store.targets[1]).toMatchObject({ name: 'Mokotów', timeZone: 'Europe/Lisbon', color: TARGET_PALETTE[1] })
  })

  it('keeps an explicit zone and color', async () => {
    const store: Store = { settings: settings(), targets: [] }

    await bookingTargetCommands.create.execute(
      { ...SCOPE, name: 'Kyiv site', timeZone: 'Europe/Kyiv', color: '#123ABC' },
      ctxFor(fakeEm(store))
    )

    expect(store.targets[0]).toMatchObject({ timeZone: 'Europe/Kyiv', color: '#123abc' })
  })

  it('rejects a blank name and a bare offset', async () => {
    const em = fakeEm({ settings: settings(), targets: [] })

    const error = await rejection(
      bookingTargetCommands.create.execute({ ...SCOPE, name: '  ', timeZone: 'GMT+2' }, ctxFor(em))
    )

    expect(error.status).toBe(400)
    expect(error.body).toMatchObject({
      details: expect.arrayContaining([
        { path: ['name'], message: 'bookings.errors.nameRequired' },
        { path: ['timeZone'], message: 'bookings.errors.timeZoneOffset' },
      ]),
    })
  })

  it('refuses to write into another organization', async () => {
    const em = fakeEm({ settings: settings(), targets: [] })

    const error = await rejection(bookingTargetCommands.create.execute({ ...SCOPE, name: 'X' }, ctxFor(em, OTHER_ORG)))

    expect(error.status).toBe(403)
  })
})

describe('bookings.targets.update and delete', () => {
  it('changes only the fields it is given', async () => {
    const existing = target({ name: 'Old', color: TARGET_PALETTE[2] })
    const store: Store = { settings: settings(), targets: [existing] }

    await bookingTargetCommands.update.execute({ ...SCOPE, id: existing.id, name: 'New' }, ctxFor(fakeEm(store)))

    expect(existing).toMatchObject({ name: 'New', color: TARGET_PALETTE[2], timeZone: 'Europe/Warsaw' })
  })

  it('answers 404 for a target that does not exist or was deleted', async () => {
    const deleted = target({ deletedAt: new Date() })
    const em = fakeEm({ settings: settings(), targets: [deleted] })

    const error = await rejection(bookingTargetCommands.update.execute({ ...SCOPE, id: deleted.id, name: 'X' }, ctxFor(em)))

    expect(error.status).toBe(404)
  })

  it('soft-deletes a target so its booking history stays intact', async () => {
    const existing = target({})
    await bookingTargetCommands.delete.execute({ id: existing.id }, ctxFor(fakeEm({ settings: settings(), targets: [existing] })))

    expect(existing.deletedAt).toBeInstanceOf(Date)
  })

  it('refuses to delete a target that still has open bookings', async () => {
    const existing = target({})
    const em = fakeEm({ settings: settings(), targets: [existing], openBookings: 2 })

    const error = await rejection(bookingTargetCommands.delete.execute({ id: existing.id }, ctxFor(em)))

    expect(error.status).toBe(409)
    expect(error.body).toMatchObject({ code: 'target_in_use', details: { openBookings: 2 } })
    expect(existing.deletedAt).toBeNull()
  })

  it('maps a unique violation to 409', async () => {
    const existing = target({})
    const em = fakeEm({ settings: settings(), targets: [existing] }, new UniqueConstraintViolationException(new Error('dup')))

    const error = await rejection(bookingTargetCommands.update.execute({ ...SCOPE, id: existing.id, name: 'X' }, ctxFor(em)))

    expect(error.status).toBe(409)
  })
})

describe('undo', () => {
  const logEntryOf = (payload: unknown) => ({ commandPayload: payload }) as never

  it('undoes a create by soft-deleting the new target', async () => {
    const created = target({})
    const em = fakeEm({ settings: settings(), targets: [created] })
    const after = { id: created.id, ...SCOPE, deletedAt: null }

    await bookingTargetCommands.create.undo!({ input: {} as never, ctx: ctxFor(em), logEntry: logEntryOf({ undo: { after } }) })

    expect(created.deletedAt).toBeInstanceOf(Date)
  })

  it('undoes an update by restoring the fields from before', async () => {
    const changed = target({ name: 'New', color: '#000000' })
    const em = fakeEm({ settings: settings(), targets: [changed] })
    const before = { id: changed.id, ...SCOPE, name: 'Old', timeZone: 'Europe/Warsaw', color: TARGET_PALETTE[3], deletedAt: null }

    await bookingTargetCommands.update.undo!({ input: {} as never, ctx: ctxFor(em), logEntry: logEntryOf({ undo: { before } }) })

    expect(changed).toMatchObject({ name: 'Old', color: TARGET_PALETTE[3] })
  })

  it('undoes a delete by bringing the target back', async () => {
    const removed = target({ deletedAt: new Date() })
    const em = fakeEm({ settings: settings(), targets: [removed] })
    const before = { id: removed.id, ...SCOPE, deletedAt: null }

    await bookingTargetCommands.delete.undo!({ input: {} as never, ctx: ctxFor(em), logEntry: logEntryOf({ undo: { before } }) })

    expect(removed.deletedAt).toBeNull()
  })
})
