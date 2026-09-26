import { UniqueConstraintViolationException } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import { ensureOrganizationScope, ensureTenantScope } from '@open-mercato/shared/lib/commands/scope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { Weekday } from '../../../../lib/time/types'
import { BookingsHoliday, BookingsSettings } from '../../data/entities'
import { bookingsSettingsSaveSchema } from '../../data/validators'
import type { BookingsSettingsSaveInput } from '../../data/validators'
import { validationDetails } from '../../lib/validation-details'
import {
  FREE_WEEKDAY_COLUMNS,
  loadBookingsHolidays,
  loadBookingsSettings,
  readBookingsSettingsView,
} from '../../services/settings/effective-settings'
import type { BookingsScope, BookingsSettingsView } from '../../services/settings/effective-settings'

export const BOOKINGS_SETTINGS_RESOURCE_KIND = 'bookings.settings'

type HolidayInput = NonNullable<BookingsSettingsSaveInput['holidays']>

function parseInput(rawInput: unknown): BookingsSettingsSaveInput {
  const parsed = bookingsSettingsSaveSchema.safeParse(rawInput ?? {})
  if (!parsed.success) {
    throw new CrudHttpError(400, {
      error: 'bookings.settings.errors.invalid',
      code: 'invalid_input',
      details: validationDetails(parsed.error),
    })
  }
  return parsed.data
}

function applyFreeWeekdays(settings: BookingsSettings, freeWeekdays: readonly Weekday[]): void {
  for (const [weekday, column] of Object.entries(FREE_WEEKDAY_COLUMNS)) {
    settings[column] = freeWeekdays.includes(Number(weekday) as Weekday)
  }
}

function applyScalars(settings: BookingsSettings, input: BookingsSettingsSaveInput): void {
  if (input.timeZone !== undefined) settings.timeZone = input.timeZone
  if (input.freeWeekdays !== undefined) applyFreeWeekdays(settings, input.freeWeekdays as Weekday[])
  if (input.warningThresholdWorkingDays !== undefined) {
    settings.warningThresholdWorkingDays = input.warningThresholdWorkingDays
  }
  if (input.conflictPolicy !== undefined) settings.conflictPolicy = input.conflictPolicy
}

async function syncHolidays(em: EntityManager, scope: BookingsScope, holidays: HolidayInput): Promise<void> {
  const wanted = new Map(holidays.map((holiday) => [holiday.date, holiday.label ?? null]))
  const removedAt = new Date()

  for (const row of await loadBookingsHolidays(em, scope)) {
    if (!wanted.has(row.holidayOn)) {
      row.deletedAt = removedAt
      continue
    }
    const label = wanted.get(row.holidayOn) ?? null
    if ((row.label ?? null) !== label) row.label = label
    wanted.delete(row.holidayOn)
  }

  for (const [holidayOn, label] of wanted) {
    em.persist(em.create(BookingsHoliday, { ...scope, holidayOn, label }))
  }
}

const saveBookingsSettingsCommand: CommandHandler<BookingsSettingsSaveInput, BookingsSettingsView> = {
  id: 'bookings.settings.save',
  async execute(rawInput, ctx) {
    const input = parseInput(rawInput)
    ensureTenantScope(ctx, input.tenantId)
    ensureOrganizationScope(ctx, input.organizationId)
    const scope: BookingsScope = { tenantId: input.tenantId, organizationId: input.organizationId }

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const existing = await loadBookingsSettings(em, scope)
    const timeZone = existing?.timeZone ?? input.timeZone
    if (!timeZone) {
      throw new CrudHttpError(400, { error: 'bookings.settings.errors.timeZoneRequired', code: 'time_zone_required' })
    }

    try {
      await withAtomicFlush(
        em,
        [
          () => {
            const settings = existing ?? em.create(BookingsSettings, { ...scope, timeZone })
            if (existing) existing.updatedAt = new Date()
            else em.persist(settings)
            applyScalars(settings, input)
          },
          async () => {
            if (input.holidays !== undefined) await syncHolidays(em, scope, input.holidays)
          },
        ],
        { transaction: true }
      )
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        throw new CrudHttpError(409, { error: 'bookings.settings.errors.conflict', code: 'settings_conflict' })
      }
      throw error
    }

    return readBookingsSettingsView(em, scope)
  },
}

registerCommand(saveBookingsSettingsCommand)

export { saveBookingsSettingsCommand }
