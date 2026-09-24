'use client'

import * as React from 'react'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { BookingConflictPolicy } from '../../../../lib/pure-engine/conflict-policy.rule'
import type { Weekday } from '../../../../lib/time/types'
import type { BookingsSettingsUpdateInput } from '../../data/validators'
import { BOOKINGS_API_PATHS } from '../../lib/api-paths'
import type { BookingsHolidayView, BookingsSettingsView } from '../../services/settings/effective-settings'

export type SettingsSection = 'timeZone' | 'calendar' | 'threshold' | 'policy'

export type SettingsDraft = {
  timeZone: string
  freeWeekdays: Weekday[]
  holidays: BookingsHolidayView[]
  warningThresholdWorkingDays: string
  conflictPolicy: BookingConflictPolicy
}

export type SettingsErrors = Partial<Record<keyof SettingsDraft, string>>

type ErrorBody = {
  error?: string
  code?: string
  details?: Array<{ path: string; message: string }>
}

function draftOf(view: BookingsSettingsView): SettingsDraft {
  return {
    timeZone: view.timeZone ?? '',
    freeWeekdays: view.freeWeekdays,
    holidays: view.holidays,
    warningThresholdWorkingDays: String(view.warningThresholdWorkingDays),
    conflictPolicy: view.conflictPolicy,
  }
}

function payloadOf(section: SettingsSection, draft: SettingsDraft): BookingsSettingsUpdateInput {
  switch (section) {
    case 'timeZone':
      return { timeZone: draft.timeZone }
    case 'calendar':
      return { freeWeekdays: draft.freeWeekdays, holidays: draft.holidays }
    case 'threshold':
      return { warningThresholdWorkingDays: Number(draft.warningThresholdWorkingDays) }
    case 'policy':
      return { conflictPolicy: draft.conflictPolicy }
  }
}

function errorsOf(body: ErrorBody | null): SettingsErrors {
  if (body?.code === 'time_zone_required') return { timeZone: body.error }
  const errors: SettingsErrors = {}
  for (const detail of body?.details ?? []) {
    const field = detail.path.split('.')[0] as keyof SettingsDraft
    errors[field] ??= detail.message
  }
  return errors
}

export function useBookingsSettings() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [view, setView] = React.useState<BookingsSettingsView | null>(null)
  const [draft, setDraft] = React.useState<SettingsDraft | null>(null)
  const [errors, setErrors] = React.useState<SettingsErrors>({})
  const [loading, setLoading] = React.useState(true)
  const [savingSection, setSavingSection] = React.useState<SettingsSection | null>(null)

  const apply = React.useCallback((next: BookingsSettingsView) => {
    setView(next)
    setDraft(draftOf(next))
    setErrors({})
  }, [])

  const reload = React.useCallback(async () => {
    setLoading(true)
    try {
      const call = await apiCall<BookingsSettingsView>(BOOKINGS_API_PATHS.settings)
      if (call.ok && call.result) apply(call.result)
      else flash(t('bookings.settings.messages.loadFailed', 'Failed to load booking settings.'), 'error')
    } finally {
      setLoading(false)
    }
  }, [apply, t])

  React.useEffect(() => {
    void reload()
  }, [reload, scopeVersion])

  const update = React.useCallback((patch: Partial<SettingsDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }, [])

  const save = React.useCallback(
    async (section: SettingsSection) => {
      if (!draft) return
      setSavingSection(section)
      try {
        const call = await apiCall<BookingsSettingsView | ErrorBody>(BOOKINGS_API_PATHS.settings, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payloadOf(section, draft)),
        })
        if (call.ok && call.result) {
          apply(call.result as BookingsSettingsView)
          flash(t('bookings.settings.messages.saved', 'Settings saved.'), 'success')
          return
        }
        const body = call.result as ErrorBody | null
        setErrors(errorsOf(body))
        flash(t(body?.error ?? 'bookings.settings.errors.saveFailed', 'Failed to save booking settings.'), 'error')
      } finally {
        setSavingSection(null)
      }
    },
    [apply, draft, t]
  )

  return { view, draft, errors, loading, savingSection, update, save, reload }
}
