'use client'

import * as React from 'react'
import { loadUnavailabilityReasonEntries } from '@open-mercato/core/modules/planner/components/unavailabilityReasons'
import type { UnavailabilityReasonEntry } from '@open-mercato/core/modules/planner/components/unavailabilityReasons'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Alert, AlertDescription } from '@open-mercato/ui/primitives/alert'
import { Button } from '@open-mercato/ui/primitives/button'
import { DialogFooter } from '@open-mercato/ui/primitives/dialog'
import { FormField } from '@open-mercato/ui/primitives/form-field'
import { Input } from '@open-mercato/ui/primitives/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { isIsoDate } from '../../../../lib/time/day-ranges'
import type { IsoDate } from '../../../../lib/time/types'
import { BOOKINGS_API_PATHS } from '../../lib/api-paths'
import { buildUnavailabilityRule, plannerSubjectTypeOf, saveUnavailability, unavailabilityDays } from './unavailability-request'

type Option = { id: string; name: string }

type SubjectOption = Option & {
  categoryId: string | null
  providerKey: string
  providerRecordId: string
  timeZone: string
}

export type UnavailabilityFormProps = {
  today: IsoDate
  onDirtyChange: (dirty: boolean) => void
  onCancel: () => void
  onSaved: () => void
}

const ALL_CATEGORIES = 'all'

const NO_REASON = 'none'

export function UnavailabilityForm({ today, onDirtyChange, onCancel, onSaved }: UnavailabilityFormProps) {
  const t = useT()
  const [subjects, setSubjects] = React.useState<SubjectOption[]>([])
  const [categories, setCategories] = React.useState<Option[]>([])
  const [categoryId, setCategoryId] = React.useState<string | null>(null)
  const [subjectId, setSubjectId] = React.useState('')
  const [from, setFrom] = React.useState<string>(today)
  const [toInclusive, setToInclusive] = React.useState<string>(today)
  const [reasons, setReasons] = React.useState<UnavailabilityReasonEntry[]>([])
  const [reasonId, setReasonId] = React.useState(NO_REASON)
  const [note, setNote] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const subject = subjects.find((option) => option.id === subjectId) ?? null
  const subjectType = subject ? plannerSubjectTypeOf(subject.providerKey) : null
  const dirty = subjectId !== '' || from !== today || toInclusive !== today || reasonId !== NO_REASON || note.trim() !== ''

  React.useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

  React.useEffect(() => {
    const optionsOf = (items: Option[] | undefined) => (items ?? []).map(({ id, name }) => ({ id, name }))
    void Promise.all([
      apiCall<{ items: SubjectOption[] }>(`${BOOKINGS_API_PATHS.subjects}?pageSize=100&isActive=true`),
      apiCall<{ items: Option[] }>(`${BOOKINGS_API_PATHS.subjectCategories}?pageSize=100`),
    ])
      .then(([subjectsCall, categoriesCall]) => {
        setSubjects(
          subjectsCall.ok
            ? (subjectsCall.result?.items ?? []).map(({ id, name, categoryId: category, providerKey, providerRecordId, timeZone }) => ({
                id,
                name,
                categoryId: category ?? null,
                providerKey,
                providerRecordId,
                timeZone,
              }))
            : []
        )
        setCategories(categoriesCall.ok ? optionsOf(categoriesCall.result?.items) : [])
        if (!subjectsCall.ok || !categoriesCall.ok) {
          flash(t('bookings.bookings.errors.optionsFailed', 'Failed to load targets or subjects.'), 'error')
        }
      })
      .catch(() => flash(t('bookings.bookings.errors.optionsFailed', 'Failed to load targets or subjects.'), 'error'))
  }, [t])

  React.useEffect(() => {
    setReasonId(NO_REASON)
    if (!subjectType) {
      setReasons([])
      return
    }
    let stale = false
    loadUnavailabilityReasonEntries(subjectType)
      .then((entries) => {
        if (!stale) setReasons(entries)
      })
      .catch(() => {
        if (stale) return
        setReasons([])
        flash(t('bookings.unavailability.errors.reasonsFailed', 'Failed to load the reasons.'), 'error')
      })
    return () => {
      stale = true
    }
  }, [subjectType, t])

  const visibleSubjects = categoryId ? subjects.filter((option) => option.categoryId === categoryId || option.id === subjectId) : subjects
  const datesValid = isIsoDate(from) && isIsoDate(toInclusive) && from <= toInclusive
  const ready = Boolean(subject && subjectType && datesValid)

  const submit = async () => {
    if (saving || !subject) return
    if (!subjectType) return setError(t('bookings.unavailability.errors.unsupportedProvider', "This subject's registry has no planner schedule."))
    if (!datesValid) return setError(t('bookings.unavailability.errors.dates', 'Give both dates; the end may not be before the start.'))
    setSaving(true)
    setError(null)
    try {
      const reason = reasons.find((entry) => entry.id === reasonId)
      const rule = buildUnavailabilityRule({
        subjectType,
        subjectId: subject.providerRecordId,
        timeZone: subject.timeZone,
        from,
        toInclusive,
        reason: reason ? { entryId: reason.id, value: reason.value } : null,
        note: note.trim() || null,
      })
      const result = await saveUnavailability(apiCall, rule, subject.id, unavailabilityDays(from, toInclusive))
      if (!result.ok) {
        const message =
          result.status === 403
            ? t('bookings.unavailability.errors.forbidden', 'You have no right to manage availability in the planner.')
            : result.error
              ? t(result.error, result.error)
              : t('bookings.unavailability.errors.saveFailed', 'Failed to save the unavailability.')
        setError(message)
        return
      }
      flash(
        t(
          'bookings.unavailability.messages.saved',
          'Unavailability saved in the planner. It appears on the timeline once the planner read is connected.'
        ),
        'success'
      )
      if (result.conflicts.length > 0) {
        flash(
          t('bookings.unavailability.messages.savedWithConflicts', 'It overlaps {count} bookings — reported, not blocked.', {
            count: result.conflicts.length,
          }),
          'warning'
        )
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t(
            'bookings.unavailability.form.hint',
            'Saved straight in the planner under its own permission. Bookings on these days are reported, never blocked.'
          )}
        </p>

        <FormField label={t('bookings.unavailability.form.category', 'Category')}>
          <Select value={categoryId ?? ALL_CATEGORIES} onValueChange={(next) => setCategoryId(next === ALL_CATEGORIES ? null : next)} disabled={saving}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>{t('bookings.unavailability.form.allCategories', 'All categories')}</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label={t('bookings.unavailability.form.subject', 'Subject')} required>
          <Select value={subjectId} onValueChange={setSubjectId} disabled={saving}>
            <SelectTrigger>
              <SelectValue placeholder={t('bookings.unavailability.form.pickSubject', 'Pick a subject')} />
            </SelectTrigger>
            <SelectContent>
              {visibleSubjects.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('bookings.unavailability.form.from', 'From')} required>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} disabled={saving} />
          </FormField>
          <FormField label={t('bookings.unavailability.form.to', 'To (inclusive)')} required>
            <Input type="date" value={toInclusive} onChange={(event) => setToInclusive(event.target.value)} disabled={saving} />
          </FormField>
        </div>

        <FormField
          label={t('bookings.unavailability.form.reason', 'Reason')}
          description={
            subjectType && reasons.length === 0
              ? t('bookings.unavailability.form.noReasons', 'No reasons defined yet; the planner dictionary is empty.')
              : undefined
          }
        >
          <Select value={reasonId} onValueChange={setReasonId} disabled={saving || !subjectType || reasons.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder={t('bookings.unavailability.form.pickReason', 'Pick a reason')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_REASON}>{t('bookings.unavailability.form.pickReason', 'Pick a reason')}</SelectItem>
              {reasons.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label={t('bookings.unavailability.form.note', 'Note')}>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} disabled={saving} />
        </FormField>

        {error ? (
          <Alert status="error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {t('bookings.actions.cancel', 'Cancel')}
        </Button>
        <Button type="button" onClick={() => void submit()} disabled={saving || !ready}>
          {t('bookings.unavailability.form.save', 'Save unavailability')}
        </Button>
      </DialogFooter>
    </>
  )
}
