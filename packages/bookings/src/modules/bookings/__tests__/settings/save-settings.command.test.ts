import { UniqueConstraintViolationException } from '@mikro-orm/core'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { saveBookingsSettingsCommand } from '../../commands/settings/save-settings.command'
import { BookingsHoliday, BookingsSettings } from '../../data/entities'

const TENANT = '6f1c2b0e-1c7a-4a52-9d3e-5b8f0d1a2c3d'
const ORG = '0b9e8d7c-6a5b-4c3d-8e2f-1a0b9c8d7e6f'
const OTHER_ORG = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

type Store = {
  settings: BookingsSettings | null
  holidays: BookingsHoliday[]
}

function holiday(date: string, label: string | null = null): BookingsHoliday {
  return Object.assign(new BookingsHoliday(), { tenantId: TENANT, organizationId: ORG, holidayOn: date, label })
}

function fakeEm(store: Store, flushError?: unknown) {
  const persisted: unknown[] = []
  const em = {
    fork: () => em,
    findOne: jest.fn(async () => store.settings),
    find: jest.fn(async () => store.holidays.filter((row) => !row.deletedAt)),
    create: jest.fn((entity: unknown, data: object) => {
      const instance = entity === BookingsSettings ? new BookingsSettings() : new BookingsHoliday()
      return Object.assign(instance, data)
    }),
    persist: jest.fn((entity: unknown) => {
      persisted.push(entity)
      if (entity instanceof BookingsSettings) store.settings = entity
      if (entity instanceof BookingsHoliday) store.holidays.push(entity)
    }),
    flush: jest.fn(async () => {
      if (flushError) throw flushError
    }),
    begin: jest.fn(async () => undefined),
    commit: jest.fn(async () => undefined),
    rollback: jest.fn(async () => undefined),
  }
  return { em, persisted }
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

function run(input: Record<string, unknown>, store: Store, options: { flushError?: unknown; organizationId?: string } = {}) {
  const { em, persisted } = fakeEm(store, options.flushError)
  const result = saveBookingsSettingsCommand.execute(
    { tenantId: TENANT, organizationId: ORG, ...input } as never,
    ctxFor(em, options.organizationId)
  )
  return { result, em, persisted }
}

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (err: unknown) => err)
  if (!isCrudHttpError(error)) throw new Error(`expected a CrudHttpError, got ${String(error)}`)
  return error
}

describe('bookings.settings.save', () => {
  it('refuses a first save that does not choose a time zone', async () => {
    const error = await rejection(run({ warningThresholdWorkingDays: 3 }, { settings: null, holidays: [] }).result)

    expect(error.status).toBe(400)
    expect(error.body).toMatchObject({ code: 'time_zone_required' })
  })

  it('creates the settings row on the first save and answers with it', async () => {
    const store: Store = { settings: null, holidays: [] }

    const view = await run({ timeZone: 'Europe/Warsaw', warningThresholdWorkingDays: 3 }, store).result

    expect(store.settings).toMatchObject({ tenantId: TENANT, organizationId: ORG, timeZone: 'Europe/Warsaw' })
    expect(view).toMatchObject({ isSaved: true, timeZone: 'Europe/Warsaw', warningThresholdWorkingDays: 3 })
  })

  it('saves one section without touching the others', async () => {
    const settings = Object.assign(new BookingsSettings(), { tenantId: TENANT, organizationId: ORG, timeZone: 'Europe/Warsaw' })
    const store: Store = { settings, holidays: [] }

    const view = await run({ conflictPolicy: 'reject' }, store).result

    expect(view).toMatchObject({ timeZone: 'Europe/Warsaw', conflictPolicy: 'reject', warningThresholdWorkingDays: 5 })
    expect([...view.freeWeekdays].sort()).toEqual([0, 6])
  })

  it('maps free weekdays onto the seven columns', async () => {
    const settings = Object.assign(new BookingsSettings(), { tenantId: TENANT, organizationId: ORG, timeZone: 'UTC' })
    const store: Store = { settings, holidays: [] }

    await run({ freeWeekdays: [5, 0] }, store).result

    expect(settings).toMatchObject({
      freeOnFriday: true,
      freeOnSunday: true,
      freeOnSaturday: false,
      freeOnMonday: false,
    })
  })

  it('adds new holidays, relabels kept ones and soft-deletes the ones left out', async () => {
    const settings = Object.assign(new BookingsSettings(), { tenantId: TENANT, organizationId: ORG, timeZone: 'UTC' })
    const kept = holiday('2026-11-11', 'Old label')
    const dropped = holiday('2026-05-01')
    const store: Store = { settings, holidays: [kept, dropped] }

    const { result, persisted } = run(
      { holidays: [{ date: '2026-11-11', label: 'Independence Day' }, { date: '2026-12-25' }] },
      store
    )
    await result

    expect(kept.label).toBe('Independence Day')
    expect(kept.deletedAt ?? null).toBeNull()
    expect(dropped.deletedAt).toBeInstanceOf(Date)
    expect(persisted).toEqual([expect.objectContaining({ holidayOn: '2026-12-25', label: null })])
  })

  it('leaves holidays alone when the save carries no holiday list', async () => {
    const settings = Object.assign(new BookingsSettings(), { tenantId: TENANT, organizationId: ORG, timeZone: 'UTC' })
    const existing = holiday('2026-05-01')
    const store: Store = { settings, holidays: [existing] }

    const { result, em } = run({ warningThresholdWorkingDays: 2 }, store)
    await result

    expect(existing.deletedAt ?? null).toBeNull()
    expect(em.persist).not.toHaveBeenCalled()
  })

  it('moves the version forward even when only the holidays change', async () => {
    const before = new Date('2026-01-01T00:00:00.000Z')
    const settings = Object.assign(new BookingsSettings(), {
      tenantId: TENANT,
      organizationId: ORG,
      timeZone: 'UTC',
      updatedAt: before,
    })

    await run({ holidays: [{ date: '2026-12-25' }] }, { settings, holidays: [] }).result

    expect(settings.updatedAt.getTime()).toBeGreaterThan(before.getTime())
  })

  it('writes everything in one transaction', async () => {
    const settings = Object.assign(new BookingsSettings(), { tenantId: TENANT, organizationId: ORG, timeZone: 'UTC' })
    const { result, em } = run({ holidays: [{ date: '2026-12-25' }] }, { settings, holidays: [] })
    await result

    expect(em.begin).toHaveBeenCalledTimes(1)
    expect(em.commit).toHaveBeenCalledTimes(1)
  })

  it('answers 409 when another save created the row at the same moment', async () => {
    const collision = new UniqueConstraintViolationException(new Error('duplicate key'))

    const error = await rejection(
      run({ timeZone: 'UTC' }, { settings: null, holidays: [] }, { flushError: collision }).result
    )

    expect(error.status).toBe(409)
    expect(error.body).toMatchObject({ code: 'settings_conflict' })
  })

  it('refuses to write into an organization outside the caller scope', async () => {
    const error = await rejection(
      run({ timeZone: 'UTC' }, { settings: null, holidays: [] }, { organizationId: OTHER_ORG }).result
    )

    expect(error.status).toBe(403)
  })

  it('refuses input the schema does not allow', async () => {
    const error = await rejection(run({ timeZone: 'GMT+3' }, { settings: null, holidays: [] }).result)

    expect(error.status).toBe(400)
    expect(error.body).toMatchObject({
      code: 'invalid_input',
      details: [{ path: ['timeZone'], message: 'bookings.errors.timeZoneOffset' }],
    })
  })
})
