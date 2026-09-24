'use client'

import * as React from 'react'
import { RadioGroup } from '@open-mercato/ui/primitives/radio'
import { RadioField } from '@open-mercato/ui/primitives/radio-field'
import { BOOKING_CONFLICT_POLICIES, isConflictPolicy } from '../../../../lib/pure-engine/conflict-policy.rule'
import type { BookingConflictPolicy } from '../../../../lib/pure-engine/conflict-policy.rule'
import { SettingsSection } from './settings-section.component'

export type ConflictPolicySectionProps = {
  value: BookingConflictPolicy
  saving: boolean
  disabled: boolean
  labels: {
    title: string
    description: string
    options: Record<BookingConflictPolicy, { label: string; description: string }>
    save: string
  }
  onChange: (policy: BookingConflictPolicy) => void
  onSave: () => void
}

export function ConflictPolicySection({ value, saving, disabled, labels, onChange, onSave }: ConflictPolicySectionProps) {
  return (
    <SettingsSection title={labels.title} description={labels.description} saveLabel={labels.save} saving={saving} disabled={disabled} onSave={onSave}>
      <RadioGroup value={value} onValueChange={(next) => isConflictPolicy(next) && onChange(next)} disabled={disabled || saving}>
        {BOOKING_CONFLICT_POLICIES.map((policy) => (
          <RadioField key={policy} value={policy} label={labels.options[policy].label} description={labels.options[policy].description} />
        ))}
      </RadioGroup>
    </SettingsSection>
  )
}
