'use client'

import * as React from 'react'
import { ComboboxInput } from '@open-mercato/ui/backend/inputs/ComboboxInput'
import { Alert, AlertDescription } from '@open-mercato/ui/primitives/alert'
import { FormField } from '@open-mercato/ui/primitives/form-field'
import { SettingsSection } from './settings-section.component'

export type TimeZoneSectionProps = {
  value: string
  zones: readonly string[]
  isSaved: boolean
  error?: string
  saving: boolean
  disabled: boolean
  labels: {
    title: string
    description: string
    field: string
    placeholder: string
    firstSave: string
    save: string
  }
  onChange: (zone: string) => void
  onSave: () => void
}

export function TimeZoneSection({ value, zones, isSaved, error, saving, disabled, labels, onChange, onSave }: TimeZoneSectionProps) {
  return (
    <SettingsSection
      title={labels.title}
      description={labels.description}
      saveLabel={labels.save}
      saving={saving}
      disabled={disabled || !value}
      onSave={onSave}
    >
      {isSaved ? null : (
        <Alert status="information">
          <AlertDescription>{labels.firstSave}</AlertDescription>
        </Alert>
      )}
      <FormField label={labels.field} required error={error}>
        <ComboboxInput
          value={value}
          onChange={onChange}
          placeholder={labels.placeholder}
          suggestions={[...zones]}
          allowCustomValues={false}
          disabled={disabled || saving}
        />
      </FormField>
    </SettingsSection>
  )
}
