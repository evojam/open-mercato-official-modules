'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { LoadingMessage } from '@open-mercato/ui/backend/detail'
import { supportedTimeZones } from '../../../../lib/time/day-ranges'
import { MAX_WARNING_THRESHOLD_WORKING_DAYS } from '../../data/validators'
import { ConflictPolicySection } from './conflict-policy-section.component'
import { TimeZoneSection } from './time-zone-section.component'
import { useBookingsSettings } from './use-bookings-settings.hook'
import { WarningThresholdSection } from './warning-threshold-section.component'
import { WorkingCalendarSection } from './working-calendar-section.component'

export function BookingsSettingsScreen() {
  const t = useT()
  const { view, draft, errors, savingSection, update, save } = useBookingsSettings()
  const zones = React.useMemo(() => supportedTimeZones(), [])
  const saveLabel = t('bookings.settings.actions.save', 'Save')

  if (!view || !draft) {
    return <LoadingMessage label={t('bookings.settings.messages.loading', 'Loading booking settings…')} />
  }

  const locked = !view.isSaved || savingSection !== null
  const translateError = (key: string) => t(key, key)

  return (
    <div className="space-y-6">
      <TimeZoneSection
        value={draft.timeZone}
        zones={zones}
        isSaved={view.isSaved}
        error={errors.timeZone ? translateError(errors.timeZone) : undefined}
        saving={savingSection === 'timeZone'}
        disabled={savingSection !== null}
        labels={{
          title: t('bookings.settings.timeZone.title', 'Time zone'),
          description: t(
            'bookings.settings.timeZone.description',
            'The zone of the organization. It decides which day it is for everything that has no place of its own.'
          ),
          field: t('bookings.settings.timeZone.field', 'Time zone'),
          placeholder: t('bookings.settings.timeZone.placeholder', 'Search, e.g. Europe/Warsaw'),
          firstSave: t(
            'bookings.settings.timeZone.firstSave',
            'Choose the time zone first. Nothing can be booked until it is saved; the other sections unlock after that.'
          ),
          save: saveLabel,
        }}
        onChange={(timeZone) => update({ timeZone })}
        onSave={() => void save('timeZone')}
      />

      <WorkingCalendarSection
        freeWeekdays={draft.freeWeekdays}
        holidays={draft.holidays}
        errors={errors}
        saving={savingSection === 'calendar'}
        disabled={locked}
        translateError={translateError}
        labels={{
          title: t('bookings.settings.calendar.title', 'Working calendar'),
          description: t(
            'bookings.settings.calendar.description',
            'Durations and warnings count working days. Free days and holidays stretch a booking; they never block one.'
          ),
          freeDays: t('bookings.settings.calendar.freeDays', 'Free days of the week'),
          weekdays: {
            0: t('bookings.settings.calendar.weekdays.sunday', 'Sunday'),
            1: t('bookings.settings.calendar.weekdays.monday', 'Monday'),
            2: t('bookings.settings.calendar.weekdays.tuesday', 'Tuesday'),
            3: t('bookings.settings.calendar.weekdays.wednesday', 'Wednesday'),
            4: t('bookings.settings.calendar.weekdays.thursday', 'Thursday'),
            5: t('bookings.settings.calendar.weekdays.friday', 'Friday'),
            6: t('bookings.settings.calendar.weekdays.saturday', 'Saturday'),
          },
          holidays: t('bookings.settings.calendar.holidays', 'Holidays'),
          holidaysEmpty: t('bookings.settings.calendar.holidaysEmpty', 'No holidays yet.'),
          holidayDate: t('bookings.settings.calendar.holidayDate', 'Date'),
          holidayLabel: t('bookings.settings.calendar.holidayLabel', 'Name (optional)'),
          addHoliday: t('bookings.settings.calendar.addHoliday', 'Add holiday'),
          removeHoliday: t('bookings.settings.calendar.removeHoliday', 'Remove holiday'),
          save: saveLabel,
        }}
        onChange={update}
        onSave={() => void save('calendar')}
      />

      <WarningThresholdSection
        value={draft.warningThresholdWorkingDays}
        max={MAX_WARNING_THRESHOLD_WORKING_DAYS}
        error={errors.warningThresholdWorkingDays ? translateError(errors.warningThresholdWorkingDays) : undefined}
        saving={savingSection === 'threshold'}
        disabled={locked}
        labels={{
          title: t('bookings.settings.threshold.title', 'Early warning'),
          description: t(
            'bookings.settings.threshold.description',
            'How many working days before the expected start an unplaced booking is flagged.'
          ),
          field: t('bookings.settings.threshold.field', 'Working days'),
          hint: t('bookings.settings.threshold.hint', 'The same number drives the bar and the "Needs attention" panel.'),
          save: saveLabel,
        }}
        onChange={(warningThresholdWorkingDays) => update({ warningThresholdWorkingDays })}
        onSave={() => void save('threshold')}
      />

      <ConflictPolicySection
        value={draft.conflictPolicy}
        saving={savingSection === 'policy'}
        disabled={locked}
        labels={{
          title: t('bookings.settings.policy.title', 'Conflict policy'),
          description: t(
            'bookings.settings.policy.description',
            'What happens when a save would book one subject twice at the same time. A clash with unavailability never blocks.'
          ),
          options: {
            advisory: {
              label: t('bookings.settings.policy.advisory.label', 'Warn'),
              description: t('bookings.settings.policy.advisory.description', 'The save goes through and the conflict is reported.'),
            },
            reject: {
              label: t('bookings.settings.policy.reject.label', 'Refuse'),
              description: t('bookings.settings.policy.reject.description', 'The save that would create an overlap fails.'),
            },
          },
          save: saveLabel,
        }}
        onChange={(conflictPolicy) => update({ conflictPolicy })}
        onSave={() => void save('policy')}
      />
    </div>
  )
}
