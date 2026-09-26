'use client'

import * as React from 'react'
import { FormField } from '@open-mercato/ui/primitives/form-field'
import { Input } from '@open-mercato/ui/primitives/input'
import { SettingsSection } from './settings-section.component'

export type WarningThresholdSectionProps = {
  value: string
  max: number
  error?: string
  saving: boolean
  disabled: boolean
  labels: {
    title: string
    description: string
    field: string
    hint: string
    save: string
  }
  onChange: (value: string) => void
  onSave: () => void
}

export function WarningThresholdSection({ value, max, error, saving, disabled, labels, onChange, onSave }: WarningThresholdSectionProps) {
  return (
    <SettingsSection title={labels.title} description={labels.description} saveLabel={labels.save} saving={saving} disabled={disabled} onSave={onSave}>
      <FormField label={labels.field} description={labels.hint} error={error}>
        <div className="w-32">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={max}
            step={1}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled || saving}
          />
        </div>
      </FormField>
    </SettingsSection>
  )
}
