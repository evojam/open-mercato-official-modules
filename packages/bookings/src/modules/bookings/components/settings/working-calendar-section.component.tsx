'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import { DatePicker } from '@open-mercato/ui/primitives/date-picker'
import { FormField } from '@open-mercato/ui/primitives/form-field'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { Input } from '@open-mercato/ui/primitives/input'
import { SwitchField } from '@open-mercato/ui/primitives/switch-field'
import type { IsoDate, Weekday } from '../../../../lib/time/types'
import type { BookingsHolidayView } from '../../services/settings/effective-settings'
import { SettingsSection } from './settings-section.component'

const WEEK_FROM_MONDAY: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 0]

export type WorkingCalendarSectionProps = {
  freeWeekdays: readonly Weekday[]
  holidays: readonly BookingsHolidayView[]
  errors: { freeWeekdays?: string; holidays?: string }
  saving: boolean
  disabled: boolean
  labels: {
    title: string
    description: string
    freeDays: string
    weekdays: Record<Weekday, string>
    holidays: string
    holidaysEmpty: string
    holidayDate: string
    holidayLabel: string
    addHoliday: string
    removeHoliday: string
    save: string
  }
  translateError: (key: string) => string
  formatDate: (date: IsoDate) => string
  onChange: (patch: { freeWeekdays?: Weekday[]; holidays?: BookingsHolidayView[] }) => void
  onSave: () => void
}

function pickedDay(date: Date): IsoDate {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function WorkingCalendarSection({
  freeWeekdays,
  holidays,
  errors,
  saving,
  disabled,
  labels,
  translateError,
  formatDate,
  onChange,
  onSave,
}: WorkingCalendarSectionProps) {
  const [newDate, setNewDate] = React.useState<Date | null>(null)
  const [newLabel, setNewLabel] = React.useState('')
  const locked = disabled || saving

  const toggleWeekday = (weekday: Weekday, free: boolean) => {
    const others = freeWeekdays.filter((day) => day !== weekday)
    onChange({ freeWeekdays: free ? [...others, weekday] : others })
  }

  const addHoliday = () => {
    if (!newDate) return
    const date = pickedDay(newDate)
    const label = newLabel.trim() || null
    const rest = holidays.filter((holiday) => holiday.date !== date)
    onChange({ holidays: [...rest, { date, label }].sort((a, b) => a.date.localeCompare(b.date)) })
    setNewDate(null)
    setNewLabel('')
  }

  return (
    <SettingsSection title={labels.title} description={labels.description} saveLabel={labels.save} saving={saving} disabled={disabled} onSave={onSave}>
      <FormField label={labels.freeDays} error={errors.freeWeekdays ? translateError(errors.freeWeekdays) : undefined}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {WEEK_FROM_MONDAY.map((weekday) => (
            <SwitchField
              key={weekday}
              label={labels.weekdays[weekday]}
              checked={freeWeekdays.includes(weekday)}
              onCheckedChange={(checked) => toggleWeekday(weekday, checked)}
              disabled={locked}
            />
          ))}
        </div>
      </FormField>

      <FormField label={labels.holidays} error={errors.holidays ? translateError(errors.holidays) : undefined}>
        <div className="space-y-2">
          {holidays.length === 0 ? <p className="text-sm text-muted-foreground">{labels.holidaysEmpty}</p> : null}
          {holidays.map((holiday) => (
            <div key={holiday.date} className="flex items-center gap-3 rounded-none border bg-background p-2 text-sm">
              <time dateTime={holiday.date} className="font-medium tabular-nums">
                {formatDate(holiday.date)}
              </time>
              <span className="truncate text-muted-foreground">{holiday.label}</span>
              <IconButton
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto"
                aria-label={labels.removeHoliday}
                disabled={locked}
                onClick={() => onChange({ holidays: holidays.filter((item) => item.date !== holiday.date) })}
              >
                <Trash2 />
              </IconButton>
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-48">
              <DatePicker value={newDate} onChange={setNewDate} placeholder={labels.holidayDate} disabled={locked} footer="none" />
            </div>
            <div className="min-w-48 flex-1">
              <Input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder={labels.holidayLabel} disabled={locked} maxLength={120} />
            </div>
            <Button type="button" variant="outline" onClick={addHoliday} disabled={locked || !newDate}>
              <Plus className="size-4" />
              {labels.addHoliday}
            </Button>
          </div>
        </div>
      </FormField>
    </SettingsSection>
  )
}
