'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import { FormField } from '@open-mercato/ui/primitives/form-field'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { RadioGroup } from '@open-mercato/ui/primitives/radio'
import { RadioField } from '@open-mercato/ui/primitives/radio-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { BOOKING_CONFLICT_POLICIES, isConflictPolicy } from '../../../../lib/pure-engine/conflict-policy.rule'
import type { BookingConflictPolicy, ConflictPolicyException } from '../../../../lib/pure-engine/conflict-policy.rule'
import { SettingsSection } from './settings-section.component'

export type PolicyCategoryOption = {
  id: string
  name: string
}

export type ConflictPolicySectionProps = {
  value: BookingConflictPolicy
  exceptions: readonly ConflictPolicyException[]
  categories: readonly PolicyCategoryOption[]
  error?: string
  saving: boolean
  disabled: boolean
  labels: {
    title: string
    description: string
    options: Record<BookingConflictPolicy, { label: string; description: string }>
    exceptions: string
    exceptionsHint: string
    exceptionsEmpty: string
    noCategories: string
    pickCategory: string
    addException: string
    removeException: string
    unknownCategory: string
    save: string
  }
  onChange: (policy: BookingConflictPolicy) => void
  onChangeExceptions: (exceptions: ConflictPolicyException[]) => void
  onSave: () => void
}

export function ConflictPolicySection({
  value,
  exceptions,
  categories,
  error,
  saving,
  disabled,
  labels,
  onChange,
  onChangeExceptions,
  onSave,
}: ConflictPolicySectionProps) {
  const [pending, setPending] = React.useState('')
  const locked = disabled || saving
  const used = new Set(exceptions.map((exception) => exception.categoryId))
  const available = categories.filter((category) => !used.has(category.id))
  const nameOf = (categoryId: string) => categories.find((category) => category.id === categoryId)?.name ?? labels.unknownCategory

  const setMode = (categoryId: string, mode: BookingConflictPolicy) =>
    onChangeExceptions(exceptions.map((exception) => (exception.categoryId === categoryId ? { ...exception, mode } : exception)))

  const addException = () => {
    if (!pending) return
    const opposite: BookingConflictPolicy = value === 'reject' ? 'advisory' : 'reject'
    onChangeExceptions([...exceptions, { categoryId: pending, mode: opposite }])
    setPending('')
  }

  const policyLabel = (policy: BookingConflictPolicy) => labels.options[policy].label

  return (
    <SettingsSection title={labels.title} description={labels.description} saveLabel={labels.save} saving={saving} disabled={disabled} onSave={onSave}>
      <RadioGroup value={value} onValueChange={(next) => isConflictPolicy(next) && onChange(next)} disabled={locked}>
        {BOOKING_CONFLICT_POLICIES.map((policy) => (
          <RadioField key={policy} value={policy} label={labels.options[policy].label} description={labels.options[policy].description} />
        ))}
      </RadioGroup>

      <FormField label={labels.exceptions} description={labels.exceptionsHint} error={error}>
        <div className="space-y-2">
          {exceptions.length === 0 ? <p className="text-sm text-muted-foreground">{labels.exceptionsEmpty}</p> : null}
          {exceptions.map((exception) => (
            <div key={exception.categoryId} className="flex items-center gap-3 rounded-none border bg-background p-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{nameOf(exception.categoryId)}</span>
              <Select
                value={exception.mode}
                onValueChange={(next) => isConflictPolicy(next) && setMode(exception.categoryId, next)}
                disabled={locked}
              >
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOOKING_CONFLICT_POLICIES.map((policy) => (
                    <SelectItem key={policy} value={policy}>
                      {policyLabel(policy)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <IconButton
                type="button"
                variant="ghost"
                size="sm"
                aria-label={labels.removeException}
                disabled={locked}
                onClick={() => onChangeExceptions(exceptions.filter((item) => item.categoryId !== exception.categoryId))}
              >
                <Trash2 />
              </IconButton>
            </div>
          ))}
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.noCategories}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={pending} onValueChange={setPending} disabled={locked || available.length === 0}>
                <SelectTrigger size="sm" className="w-64">
                  <SelectValue placeholder={labels.pickCategory} />
                </SelectTrigger>
                <SelectContent>
                  {available.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={addException} disabled={locked || !pending}>
                <Plus className="size-4" />
                {labels.addException}
              </Button>
            </div>
          )}
        </div>
      </FormField>
    </SettingsSection>
  )
}
