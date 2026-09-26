import { bookingsSettingsSaveSchema, bookingsSettingsUpdateSchema } from '../../data/validators'

function issuesOf(input: unknown): string[] {
  const parsed = bookingsSettingsUpdateSchema.safeParse(input)
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)
}

describe('bookingsSettingsUpdateSchema', () => {
  it('accepts a single section on its own', () => {
    expect(bookingsSettingsUpdateSchema.parse({ warningThresholdWorkingDays: 3 })).toEqual({ warningThresholdWorkingDays: 3 })
  })

  it.each([
    ['europe/warsaw', 'Europe/Warsaw'],
    [' Europe/Lisbon ', 'Europe/Lisbon'],
    ['UTC', 'UTC'],
  ])('stores %p under its canonical name %p', (input, expected) => {
    expect(bookingsSettingsUpdateSchema.parse({ timeZone: input }).timeZone).toBe(expected)
  })

  it.each(['Europe/Kyiv', 'Asia/Kolkata'])('keeps the current name %p instead of the legacy one ICU resolves to', (timeZone) => {
    expect(bookingsSettingsUpdateSchema.parse({ timeZone }).timeZone).toBe(timeZone)
  })

  it('rejects an emptied threshold instead of reading it as zero', () => {
    expect(issuesOf({ warningThresholdWorkingDays: null })).toEqual(['bookings.settings.errors.threshold'])
  })

  it.each(['GMT+3', '+03:00', '-05:00', 'UTC+2', 'Etc/GMT-3'])('rejects the bare offset %p', (timeZone) => {
    expect(issuesOf({ timeZone })).toEqual(['bookings.errors.timeZoneOffset'])
  })

  it.each(['Mars/Olympus', ''])('rejects the unknown zone %p', (timeZone) => {
    expect(issuesOf({ timeZone })).toContain('bookings.errors.timeZoneUnknown')
  })

  it('rejects a calendar with no working day left', () => {
    expect(issuesOf({ freeWeekdays: [0, 1, 2, 3, 4, 5, 6] })).toEqual(['bookings.settings.errors.noWorkingDay'])
  })

  it('rejects a weekday listed twice and a weekday out of range', () => {
    expect(issuesOf({ freeWeekdays: [6, 6] })).toEqual(['bookings.settings.errors.freeWeekdaysDuplicate'])
    expect(issuesOf({ freeWeekdays: [7] })).toHaveLength(1)
  })

  it('accepts holidays with and without a label', () => {
    const holidays = [{ date: '2026-11-11', label: 'Independence Day' }, { date: '2026-12-25' }]

    expect(bookingsSettingsUpdateSchema.parse({ holidays }).holidays).toEqual(holidays)
  })

  it('rejects the same holiday twice and a date that does not exist', () => {
    expect(issuesOf({ holidays: [{ date: '2026-11-11' }, { date: '2026-11-11' }] })).toEqual([
      'bookings.settings.errors.holidayDuplicate',
    ])
    expect(issuesOf({ holidays: [{ date: '2026-02-30' }] })).toEqual(['bookings.settings.errors.holidayDate'])
  })

  it.each([-1, 1.5, 251])('rejects the threshold %p', (warningThresholdWorkingDays) => {
    expect(issuesOf({ warningThresholdWorkingDays })).toHaveLength(1)
  })

  it('rejects an unknown conflict policy and an unknown field', () => {
    expect(issuesOf({ conflictPolicy: 'block' })).toHaveLength(1)
    expect(issuesOf({ lastScanLocalDate: '2026-09-24' })).toHaveLength(1)
  })
})

describe('bookingsSettingsSaveSchema', () => {
  it('requires the scope the command writes into', () => {
    expect(bookingsSettingsSaveSchema.safeParse({ timeZone: 'UTC' }).success).toBe(false)
    expect(
      bookingsSettingsSaveSchema.safeParse({
        timeZone: 'UTC',
        tenantId: '6f1c2b0e-1c7a-4a52-9d3e-5b8f0d1a2c3d',
        organizationId: '0b9e8d7c-6a5b-4c3d-8e2f-1a0b9c8d7e6f',
      }).success
    ).toBe(true)
  })
})
