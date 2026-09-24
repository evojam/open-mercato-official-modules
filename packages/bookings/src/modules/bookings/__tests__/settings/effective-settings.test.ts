import type { EntityManager } from '@mikro-orm/core'
import { BookingsHoliday, BookingsSettings } from '../../data/entities'
import {
  BOOKINGS_SETTINGS_DEFAULTS,
  readBookingsSettingsView,
  resolveEffectiveBookingsSettings,
} from '../../services/settings/effective-settings'

const SCOPE = { tenantId: 'tenant-1', organizationId: 'org-1' }

function holiday(date: string): BookingsHoliday {
  return Object.assign(new BookingsHoliday(), { holidayOn: date })
}

function fakeEm(settings: BookingsSettings | null, holidays: BookingsHoliday[] = []) {
  const em = {
    findOne: jest.fn().mockResolvedValue(settings),
    find: jest.fn().mockResolvedValue(holidays),
  }
  return { em, asEm: em as unknown as EntityManager }
}

describe('resolveEffectiveBookingsSettings', () => {
  it('answers from the defaults with no zone before the settings screen was ever saved', async () => {
    const { asEm } = fakeEm(null, [holiday('2026-11-11')])

    await expect(resolveEffectiveBookingsSettings(asEm, SCOPE)).resolves.toEqual({
      calendar: { freeWeekdays: [6, 0], holidays: ['2026-11-11'] },
      warningThresholdWorkingDays: 5,
      conflictPolicy: 'advisory',
      timeZone: null,
    })
  })

  it('maps the stored row onto the engine calendar', async () => {
    const settings = Object.assign(new BookingsSettings(), {
      freeOnSaturday: false,
      freeOnSunday: true,
      freeOnFriday: true,
      warningThresholdWorkingDays: 3,
      conflictPolicy: 'reject',
      timeZone: 'Europe/Warsaw',
    })
    const { asEm } = fakeEm(settings, [holiday('2026-12-25'), holiday('2026-12-26')])

    const effective = await resolveEffectiveBookingsSettings(asEm, SCOPE)

    expect([...effective.calendar.freeWeekdays].sort()).toEqual([0, 5])
    expect(effective.calendar.holidays).toEqual(['2026-12-25', '2026-12-26'])
    expect(effective.warningThresholdWorkingDays).toBe(3)
    expect(effective.conflictPolicy).toBe('reject')
    expect(effective.timeZone).toBe('Europe/Warsaw')
  })

  it('reads only the rows of its own organization and skips deleted holidays', async () => {
    const { em, asEm } = fakeEm(null)

    await resolveEffectiveBookingsSettings(asEm, SCOPE)

    expect(em.findOne).toHaveBeenCalledWith(BookingsSettings, SCOPE)
    expect(em.find).toHaveBeenCalledWith(BookingsHoliday, { ...SCOPE, deletedAt: null }, { orderBy: { holidayOn: 'asc' } })
  })

  it('keeps its defaults equal to the column defaults, so a first save changes nothing silently', async () => {
    const fresh = Object.assign(new BookingsSettings(), { timeZone: 'UTC' })
    const { asEm } = fakeEm(fresh)

    const effective = await resolveEffectiveBookingsSettings(asEm, SCOPE)

    expect([...effective.calendar.freeWeekdays].sort()).toEqual([...BOOKINGS_SETTINGS_DEFAULTS.freeWeekdays].sort())
    expect(effective.warningThresholdWorkingDays).toBe(BOOKINGS_SETTINGS_DEFAULTS.warningThresholdWorkingDays)
    expect(effective.conflictPolicy).toBe(BOOKINGS_SETTINGS_DEFAULTS.conflictPolicy)
  })
})

describe('readBookingsSettingsView', () => {
  it('tells the screen nothing was saved yet and keeps the zone empty', async () => {
    const { asEm } = fakeEm(null)

    await expect(readBookingsSettingsView(asEm, SCOPE)).resolves.toMatchObject({
      isSaved: false,
      timeZone: null,
      updatedAt: null,
    })
  })

  it('returns holidays with their labels and the version the screen saves against', async () => {
    const settings = Object.assign(new BookingsSettings(), {
      timeZone: 'Europe/Warsaw',
      updatedAt: new Date('2026-09-24T10:00:00.000Z'),
    })
    const labelled = Object.assign(holiday('2026-11-11'), { label: 'Independence Day' })
    const { asEm } = fakeEm(settings, [labelled, holiday('2026-12-25')])

    await expect(readBookingsSettingsView(asEm, SCOPE)).resolves.toMatchObject({
      isSaved: true,
      holidays: [
        { date: '2026-11-11', label: 'Independence Day' },
        { date: '2026-12-25', label: null },
      ],
      updatedAt: '2026-09-24T10:00:00.000Z',
    })
  })
})
