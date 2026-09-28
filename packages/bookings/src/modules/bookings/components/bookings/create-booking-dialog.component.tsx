'use client'

import * as React from 'react'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Alert, AlertDescription } from '@open-mercato/ui/primitives/alert'
import { Button } from '@open-mercato/ui/primitives/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@open-mercato/ui/primitives/dialog'
import { FormField } from '@open-mercato/ui/primitives/form-field'
import { Input } from '@open-mercato/ui/primitives/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import type { IsoDate } from '../../../../lib/time/types'
import type { BookingCreateResult } from '../../commands/bookings/create-booking.command'
import { BOOKINGS_API_PATHS } from '../../lib/api-paths'

type Option = { id: string; name: string }

type Field = 'targetId' | 'subjectIds' | 'startOn' | 'durationValue' | 'expectedStartOn' | 'note'

type ErrorBody = {
  error?: string
  code?: string
  details?: Array<{ path: Array<string | number>; message: string }> | { conflicts?: unknown[] }
}

export type CreateBookingDialogProps = {
  open: boolean
  today: IsoDate
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

function fieldErrorsOf(body: ErrorBody | null): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {}
  if (!Array.isArray(body?.details)) return errors
  for (const detail of body.details) {
    const field = String(detail.path[0]) as Field
    errors[field] ??= detail.message
  }
  return errors
}

export function CreateBookingDialog({ open, today, onOpenChange, onCreated }: CreateBookingDialogProps) {
  const t = useT()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const [targets, setTargets] = React.useState<Option[]>([])
  const [subjects, setSubjects] = React.useState<Option[]>([])
  const [targetId, setTargetId] = React.useState('')
  const [subjectId, setSubjectId] = React.useState('')
  const [startOn, setStartOn] = React.useState<string>(today)
  const [durationValue, setDurationValue] = React.useState('1')
  const [expectedStartOn, setExpectedStartOn] = React.useState<string>(today)
  const [note, setNote] = React.useState('')
  const [errors, setErrors] = React.useState<Partial<Record<Field, string>>>({})
  const [rejected, setRejected] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setTargetId('')
    setSubjectId('')
    setStartOn(today)
    setExpectedStartOn(today)
    setDurationValue('1')
    setNote('')
    setErrors({})
    setRejected(null)
    const optionsOf = (items: Option[] | undefined) => (items ?? []).map(({ id, name }) => ({ id, name }))
    const loadFailed = () => flash(t('bookings.bookings.errors.optionsFailed', 'Failed to load targets or subjects.'), 'error')
    void Promise.all([
      apiCall<{ items: Option[] }>(`${BOOKINGS_API_PATHS.targets}?pageSize=100`),
      apiCall<{ items: Option[] }>(`${BOOKINGS_API_PATHS.subjects}?pageSize=100&isActive=true`),
    ])
      .then(([targetsCall, subjectsCall]) => {
        setTargets(targetsCall.ok ? optionsOf(targetsCall.result?.items) : [])
        setSubjects(subjectsCall.ok ? optionsOf(subjectsCall.result?.items) : [])
        if (!targetsCall.ok || !subjectsCall.ok) loadFailed()
      })
      .catch(loadFailed)
  }, [open, today, t])

  const translate = (key: string | undefined) => (key ? t(key, key) : undefined)
  const ready = Boolean(targetId && subjectId && expectedStartOn && durationValue)

  const submit = async () => {
    if (saving || !ready) return
    setSaving(true)
    setRejected(null)
    try {
      const call = await apiCall<BookingCreateResult | ErrorBody>(BOOKINGS_API_PATHS.bookings, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          tenantId,
          targetId,
          subjectIds: [subjectId],
          startOn: startOn || null,
          durationValue: Number(durationValue),
          expectedStartOn,
          note: note.trim() || null,
        }),
      })
      if (call.ok && call.result) {
        const created = call.result as BookingCreateResult
        flash(t('bookings.bookings.messages.created', 'Booking created.'), 'success')
        if (created.conflicts.length > 0) {
          flash(
            t('bookings.bookings.messages.createdWithConflicts', 'Saved with {count} conflicts — check the red bars.', {
              count: created.conflicts.length,
            }),
            'warning'
          )
        }
        if (created.warnings.includes('start_on_free_day')) {
          flash(t('bookings.bookings.messages.startOnFreeDay', 'The booking starts on a day off.'), 'warning')
        }
        onCreated()
        onOpenChange(false)
        return
      }
      const body = call.result as ErrorBody | null
      setErrors(fieldErrorsOf(body))
      const message = body?.error ?? 'bookings.bookings.errors.createFailed'
      if (body?.code === 'booking_conflict') setRejected(t(message, message))
      else flash(t(message, message), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            void submit()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('bookings.bookings.create.title', 'New booking')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <FormField label={t('bookings.bookings.create.target', 'Target')} error={translate(errors.targetId)} required>
            <Select value={targetId} onValueChange={setTargetId} disabled={saving}>
              <SelectTrigger>
                <SelectValue placeholder={t('bookings.bookings.create.pickTarget', 'Pick a target')} />
              </SelectTrigger>
              <SelectContent>
                {targets.map((target) => (
                  <SelectItem key={target.id} value={target.id}>
                    {target.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t('bookings.bookings.create.subject', 'Subject')} error={translate(errors.subjectIds)} required>
            <Select value={subjectId} onValueChange={setSubjectId} disabled={saving}>
              <SelectTrigger>
                <SelectValue placeholder={t('bookings.bookings.create.pickSubject', 'Pick a subject')} />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label={t('bookings.bookings.create.startOn', 'Start')}
              description={t('bookings.bookings.create.startOnHint', 'Leave empty to place it later.')}
              error={translate(errors.startOn)}
            >
              <Input type="date" value={startOn} onChange={(event) => setStartOn(event.target.value)} disabled={saving} />
            </FormField>
            <FormField
              label={t('bookings.bookings.create.duration', 'Working days')}
              error={translate(errors.durationValue)}
              required
            >
              <Input
                type="number"
                min={0.5}
                step={0.5}
                value={durationValue}
                onChange={(event) => setDurationValue(event.target.value)}
                disabled={saving}
              />
            </FormField>
          </div>

          <FormField
            label={t('bookings.bookings.create.expectedStartOn', 'Must start by')}
            error={translate(errors.expectedStartOn)}
            required
          >
            <Input
              type="date"
              value={expectedStartOn}
              onChange={(event) => setExpectedStartOn(event.target.value)}
              disabled={saving}
            />
          </FormField>

          <FormField label={t('bookings.bookings.create.note', 'Note')} error={translate(errors.note)}>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} disabled={saving} />
          </FormField>

          {rejected ? (
            <Alert status="error">
              <AlertDescription>{rejected}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('bookings.actions.cancel', 'Cancel')}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving || !ready}>
            {t('bookings.bookings.create.submit', 'Create booking')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
