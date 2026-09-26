'use client'

import * as React from 'react'
import { CrudForm, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { TARGET_PALETTE } from '../../../../lib/timeline/palette'
import { ColorSwatches } from '../shared/color-swatches.component'
import { CATEGORY_ICONS } from './category-icons'

export type CategoryFormValues = {
  name: string
  icon: string | null
  color: string | null
}

export type CategoryFormProps = {
  mode: 'create' | 'edit'
  initialValues?: Partial<CategoryFormValues>
  isLoading?: boolean
  onSubmit: (values: CategoryFormValues) => Promise<void>
  onDelete?: () => Promise<void>
}

export const CATEGORIES_LIST_HREF = '/backend/bookings/categories'

type IconPickerProps = {
  value: string | null
  disabled?: boolean
  labelFor: (name: string) => string
  onChange: (name: string) => void
}

function IconPicker({ value, disabled, labelFor, onChange }: IconPickerProps) {
  return (
    <div role="radiogroup" className="grid grid-cols-6 gap-2 sm:grid-cols-9">
      {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => {
        const selected = value === name
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={labelFor(name)}
            title={name}
            disabled={disabled}
            onClick={() => onChange(name)}
            className={cn(
              'flex size-9 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-50',
              selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted'
            )}
          >
            <Icon className="size-4" />
          </button>
        )
      })}
    </div>
  )
}

export function CategoryForm({ mode, initialValues, isLoading, onSubmit, onDelete }: CategoryFormProps) {
  const t = useT()

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'category',
        column: 1,
        title: t('bookings.categories.form.group', 'Category'),
        fields: [
          {
            id: 'name',
            type: 'text',
            label: t('bookings.categories.form.name', 'Name'),
            required: true,
            maxLength: 200,
          },
          {
            id: 'icon',
            type: 'custom',
            label: t('bookings.categories.form.icon', 'Icon'),
            component: ({ value, setValue, disabled }) => (
              <IconPicker
                value={typeof value === 'string' ? value : null}
                disabled={disabled}
                labelFor={(name) => t('bookings.categories.form.iconOption', 'Icon {name}').replace('{name}', name)}
                onChange={setValue}
              />
            ),
          },
          {
            id: 'color',
            type: 'custom',
            label: t('bookings.categories.form.color', 'Color'),
            description:
              mode === 'create' ? t('bookings.categories.form.colorHint', 'Leave unselected to get the next free color.') : undefined,
            component: ({ value, setValue, disabled }) => (
              <ColorSwatches
                colors={TARGET_PALETTE}
                value={typeof value === 'string' ? value : null}
                disabled={disabled}
                labelFor={(_color, index) => t('bookings.colors.option', 'Color {n}').replace('{n}', String(index + 1))}
                onChange={setValue}
              />
            ),
          },
        ],
      },
    ],
    [mode, t]
  )

  return (
    <CrudForm<CategoryFormValues>
      title={mode === 'create' ? t('bookings.categories.create.title', 'New category') : t('bookings.categories.edit.title', 'Edit category')}
      backHref={CATEGORIES_LIST_HREF}
      cancelHref={CATEGORIES_LIST_HREF}
      fields={[]}
      groups={groups}
      initialValues={initialValues}
      isLoading={isLoading}
      submitLabel={mode === 'create' ? t('bookings.actions.create', 'Create') : t('bookings.actions.save', 'Save')}
      onSubmit={async (values) =>
        onSubmit({
          name: String(values.name ?? '').trim(),
          icon: typeof values.icon === 'string' && values.icon ? values.icon : null,
          color: typeof values.color === 'string' && values.color ? values.color : null,
        })
      }
      onDelete={onDelete}
    />
  )
}
