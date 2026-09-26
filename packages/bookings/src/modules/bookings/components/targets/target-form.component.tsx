'use client'

import * as React from 'react'
import { CrudForm, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { TARGET_PALETTE } from '../../../../lib/timeline/palette'
import { supportedTimeZones } from '../../../../lib/time/day-ranges'
import { ColorSwatches } from '../shared/color-swatches.component'

export type TargetFormValues = {
  name: string
  timeZone: string
  color: string | null
}

export type TargetFormProps = {
  mode: 'create' | 'edit'
  initialValues?: Partial<TargetFormValues>
  isLoading?: boolean
  onSubmit: (values: TargetFormValues) => Promise<void>
  onDelete?: () => Promise<void>
}

export const TARGETS_LIST_HREF = '/backend/bookings/targets'

export function TargetForm({ mode, initialValues, isLoading, onSubmit, onDelete }: TargetFormProps) {
  const t = useT()
  const zones = React.useMemo(() => [...supportedTimeZones()], [])

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'target',
        column: 1,
        title: t('bookings.targets.form.group', 'Target'),
        fields: [
          {
            id: 'name',
            type: 'text',
            label: t('bookings.targets.form.name', 'Name'),
            required: true,
            maxLength: 200,
          },
          {
            id: 'timeZone',
            type: 'combobox',
            label: t('bookings.targets.form.timeZone', 'Time zone'),
            suggestions: zones,
            allowCustomValues: false,
            description:
              mode === 'create'
                ? t('bookings.targets.form.timeZoneHint', "Leave empty to use the organization's time zone.")
                : t(
                    'bookings.targets.form.timeZoneEditHint',
                    'Bookings of this target are read in its zone, so changing it can move them to another day.'
                  ),
          },
          {
            id: 'color',
            type: 'custom',
            label: t('bookings.targets.form.color', 'Color on the timeline'),
            description:
              mode === 'create'
                ? t('bookings.targets.form.colorHint', 'Leave unselected to get the next free color.')
                : undefined,
            component: ({ value, setValue, disabled }) => (
              <ColorSwatches
                colors={TARGET_PALETTE}
                value={typeof value === 'string' ? value : null}
                disabled={disabled}
                labelFor={(_color, index) => t('bookings.colors.option', 'Color {n}', { n: index + 1 })}
                onChange={setValue}
              />
            ),
          },
        ],
      },
    ],
    [mode, t, zones]
  )

  return (
    <CrudForm<TargetFormValues>
      title={mode === 'create' ? t('bookings.targets.create.title', 'New target') : t('bookings.targets.edit.title', 'Edit target')}
      backHref={TARGETS_LIST_HREF}
      cancelHref={TARGETS_LIST_HREF}
      fields={[]}
      groups={groups}
      initialValues={initialValues}
      isLoading={isLoading}
      submitLabel={mode === 'create' ? t('bookings.actions.create', 'Create') : t('bookings.actions.save', 'Save')}
      onSubmit={async (values) =>
        onSubmit({
          name: String(values.name ?? '').trim(),
          timeZone: String(values.timeZone ?? '').trim(),
          color: typeof values.color === 'string' && values.color ? values.color : null,
        })
      }
      onDelete={onDelete}
    />
  )
}
