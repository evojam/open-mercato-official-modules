'use client'

import * as React from 'react'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Alert, AlertDescription } from '@open-mercato/ui/primitives/alert'
import { Button } from '@open-mercato/ui/primitives/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@open-mercato/ui/primitives/dialog'
import { FormField } from '@open-mercato/ui/primitives/form-field'
import { Input } from '@open-mercato/ui/primitives/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { isClosed } from '../../../../lib/pure-engine'
import type { BookingStatus, Conflict, WorkingCalendar } from '../../../../lib/pure-engine'
import { lastDayOf } from '../../../../lib/timeline/layout/range'
import type { IsoDate } from '../../../../lib/time/types'
import type { BookingWriteResult } from '../../commands/shared/booking-write.commands'
import { BOOKINGS_API_PATHS } from '../../lib/api-paths'
import { daysLabel } from '../timeline/timeline.presenter'
import { UnavailabilityForm } from '../unavailability/unavailability-form.component'
import { isDirty, planBookingSave, windowOf } from './booking-dialog.presenter'
import type { BookingFormOrigin, BookingFormValues, BookingSaveStep } from './booking-dialog.presenter'
import { BookingStatusControl } from './booking-status-control.component'
import { useConflictPreview } from './use-conflict-preview.hook'

type Option = { id: string; name: string }

type SubjectOption = Option & { categoryId: string | null }

type BookingItem = {
  id: string
  targetId: string | null
  subjectIds: string[]
  status: BookingStatus
  startOn: string | null
  durationValue: string
  expectedStartOn: string
  note: string | null
}

type Field = 'targetId' | 'subjectIds' | 'startOn' | 'durationValue' | 'expectedStartOn' | 'note'

type ErrorBody = {
  error?: string
  code?: string
  details?: Array<{ path: Array<string | number>; message: string }> | { conflicts?: unknown[] }
}

type ComposerKind = 'booking' | 'unavailability'

export type BookingDialogMode = { kind: 'create' } | { kind: 'edit'; bookingId: string }

export type BookingDialogProps = {
  open: boolean
  mode: BookingDialogMode
  today: IsoDate
  calendar: WorkingCalendar
  canWriteUnavailability: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const ALL_CATEGORIES = 'all'

const COMPOSER_KINDS: readonly ComposerKind[] = ['booking', 'unavailability']

const SAVE_FAILED = 'bookings.bookings.errors.saveFailed'

function emptyValues(today: IsoDate): BookingFormValues {
  return { targetId: '', subjectId: '', startOn: today, durationValue: '1', expectedStartOn: today, note: '' }
}

function originOf(booking: BookingItem): BookingFormOrigin {
  return {
    targetId: booking.targetId ?? '',
    subjectId: booking.subjectIds[0] ?? '',
    startOn: booking.startOn ?? '',
    durationValue: String(Number(booking.durationValue)),
    expectedStartOn: booking.expectedStartOn,
    note: booking.note ?? '',
    placed: booking.startOn !== null,
    participantCount: booking.subjectIds.length,
  }
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

export function BookingDialog({ open, mode, today, calendar, canWriteUnavailability, onOpenChange, onSaved }: BookingDialogProps) {
  const t = useT()
  const locale = useLocale()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [kind, setKind] = React.useState<ComposerKind>('booking')
  const [unavailabilityDirty, setUnavailabilityDirty] = React.useState(false)
  const [targets, setTargets] = React.useState<Option[]>([])
  const [subjects, setSubjects] = React.useState<SubjectOption[]>([])
  const [categories, setCategories] = React.useState<Option[]>([])
  const [categoryId, setCategoryId] = React.useState<string | null>(null)
  const [values, setValues] = React.useState<BookingFormValues>(() => emptyValues(today))
  const [origin, setOrigin] = React.useState<BookingFormOrigin | null>(null)
  const [booking, setBooking] = React.useState<BookingItem | null>(null)
  const [errors, setErrors] = React.useState<Partial<Record<Field, string>>>({})
  const [rejected, setRejected] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const editing = mode.kind === 'edit' ? mode.bookingId : null
  const composing = kind === 'unavailability'
  const readOnly = booking !== null && isClosed(booking.status)
  const callbacks = React.useRef({ t, onOpenChange })
  callbacks.current = { t, onOpenChange }
  const scope = React.useMemo(() => ({ organizationId, tenantId }), [organizationId, tenantId])
  const formatDate = React.useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' })
    return (date: string) => formatter.format(new Date(`${date}T00:00:00Z`))
  }, [locale])

  React.useEffect(() => {
    if (!open) return
    let stale = false
    setKind('booking')
    setUnavailabilityDirty(false)
    setValues(emptyValues(today))
    setOrigin(editing ? null : { ...emptyValues(today), placed: false, participantCount: 0 })
    setBooking(null)
    setCategoryId(null)
    setErrors({})
    setRejected(null)
    setLoading(true)
    const loadFailed = (key: string, fallback: string) => flash(callbacks.current.t(key, fallback), 'error')
    const optionsOf = (items: Option[] | undefined) => (items ?? []).map(({ id, name }) => ({ id, name }))
    const load = async () => {
      try {
        const [targetsCall, subjectsCall, categoriesCall, bookingCall] = await Promise.all([
          apiCall<{ items: Option[] }>(`${BOOKINGS_API_PATHS.targets}?pageSize=100`),
          apiCall<{ items: SubjectOption[] }>(`${BOOKINGS_API_PATHS.subjects}?pageSize=100&isActive=true`),
          apiCall<{ items: Option[] }>(`${BOOKINGS_API_PATHS.subjectCategories}?pageSize=100`),
          editing ? apiCall<{ items: BookingItem[] }>(`${BOOKINGS_API_PATHS.bookings}?id=${editing}`) : Promise.resolve(null),
        ])
        if (stale) return
        setTargets(targetsCall.ok ? optionsOf(targetsCall.result?.items) : [])
        setSubjects(
          subjectsCall.ok
            ? (subjectsCall.result?.items ?? []).map(({ id, name, categoryId: category }) => ({ id, name, categoryId: category ?? null }))
            : []
        )
        setCategories(categoriesCall.ok ? optionsOf(categoriesCall.result?.items) : [])
        if (!targetsCall.ok || !subjectsCall.ok || !categoriesCall.ok) {
          loadFailed('bookings.bookings.errors.optionsFailed', 'Failed to load targets or subjects.')
        }
        if (!bookingCall) return
        const item = bookingCall.ok ? bookingCall.result?.items?.[0] : undefined
        if (!item) {
          loadFailed('bookings.bookings.errors.loadFailed', 'Failed to load the booking.')
          callbacks.current.onOpenChange(false)
          return
        }
        const loaded = originOf(item)
        setBooking(item)
        setOrigin(loaded)
        setValues(loaded)
      } catch {
        if (!stale) loadFailed('bookings.bookings.errors.optionsFailed', 'Failed to load targets or subjects.')
      } finally {
        if (!stale) setLoading(false)
      }
    }
    void load()
    return () => {
      stale = true
    }
  }, [open, editing, today])

  const set = (patch: Partial<BookingFormValues>) => setValues((current) => ({ ...current, ...patch }))
  const translate = (key: string | undefined) => (key ? t(key, key) : undefined)

  const visibleSubjects = React.useMemo(
    () => (categoryId ? subjects.filter((subject) => subject.categoryId === categoryId || subject.id === values.subjectId) : subjects),
    [subjects, categoryId, values.subjectId]
  )
  const window = React.useMemo(
    () => windowOf(values.startOn, values.durationValue, calendar),
    [values.startOn, values.durationValue, calendar]
  )
  const preview = useConflictPreview({
    subjectIds: visibleSubjects.map((subject) => subject.id),
    window,
    excludeBookingId: editing,
    enabled: open && !composing && !readOnly && !loading,
  })
  const selectedConflicts = preview.conflicts.filter((conflict) => conflict.subjectId === values.subjectId)
  const selectedSubjectName = subjects.find((subject) => subject.id === values.subjectId)?.name ?? ''
  const dirty = composing ? unavailabilityDirty : origin !== null && isDirty(origin, values)
  const complete = Boolean(values.targetId && values.subjectId && values.expectedStartOn && Number(values.durationValue) > 0)
  const busy = saving || loading
  const fieldsDisabled = busy || readOnly
  const primaryDisabled = busy || !complete || (editing ? !dirty || (origin?.placed && !values.startOn) : !values.startOn)

  const requestClose = async () => {
    if (saving) return
    if (dirty && !readOnly) {
      const discard = await confirm({
        title: t('bookings.bookings.form.discardTitle', 'Discard changes?'),
        text: t('bookings.bookings.form.discardText', 'The form has changes that are not saved.'),
        confirmText: t('bookings.bookings.form.discard', 'Discard'),
        variant: 'destructive',
      })
      if (!discard) return
    }
    onOpenChange(false)
  }

  const reportSuccess = (result: BookingWriteResult, message: string) => {
    flash(message, 'success')
    if (result.conflicts.length > 0) {
      flash(
        t('bookings.bookings.messages.savedWithConflicts', 'Saved with {count} conflicts — check the red bars.', {
          count: result.conflicts.length,
        }),
        'warning'
      )
    }
    if (result.warnings.includes('start_on_free_day')) {
      flash(t('bookings.bookings.messages.startOnFreeDay', 'The booking starts on a day off.'), 'warning')
    }
  }

  const reportFailure = (body: ErrorBody | null) => {
    setErrors(fieldErrorsOf(body))
    const message = body?.error ?? SAVE_FAILED
    if (body?.code === 'booking_conflict') setRejected(t(message, message))
    else flash(t(message, message), 'error')
  }

  const post = (path: string, method: 'POST' | 'PUT', body: Record<string, unknown>) =>
    apiCall<BookingWriteResult | ErrorBody>(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...scope, ...body }),
    })

  const create = async (place: boolean) => {
    if (busy || !complete || (place && !values.startOn)) return
    setSaving(true)
    setRejected(null)
    try {
      const call = await post(BOOKINGS_API_PATHS.bookings, 'POST', {
        targetId: values.targetId,
        subjectIds: [values.subjectId],
        startOn: place ? values.startOn : null,
        durationValue: Number(values.durationValue),
        expectedStartOn: values.expectedStartOn,
        note: values.note.trim() || null,
      })
      if (!call.ok || !call.result) return reportFailure(call.result as ErrorBody | null)
      reportSuccess(
        call.result as BookingWriteResult,
        place
          ? t('bookings.bookings.messages.created', 'Booking created.')
          : t('bookings.bookings.messages.savedForLater', 'Saved without a start date. It waits to be placed.')
      )
      onSaved()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const runStep = (id: string, step: BookingSaveStep) =>
    step.kind === 'update'
      ? post(BOOKINGS_API_PATHS.bookings, 'PUT', { id, ...step.body })
      : post(BOOKINGS_API_PATHS.bookingActions[step.kind], 'POST', { id, ...step.body })

  const saveEdit = async () => {
    if (busy || !editing || !origin || !complete) return
    const steps = planBookingSave(origin, values)
    if (steps.length === 0) return onOpenChange(false)
    setSaving(true)
    setRejected(null)
    try {
      let applied = 0
      let last: BookingWriteResult | null = null
      for (const step of steps) {
        const call = await runStep(editing, step)
        if (!call.ok || !call.result) {
          reportFailure(call.result as ErrorBody | null)
          if (applied > 0) {
            flash(
              t('bookings.bookings.messages.stepFailed', 'Saving stopped at: {step}. The earlier changes are in.', {
                step: t(`bookings.bookings.steps.${step.kind}`, step.kind),
              }),
              'warning'
            )
            onSaved()
          }
          return
        }
        applied += 1
        last = call.result as BookingWriteResult
      }
      if (last) reportSuccess(last, t('bookings.bookings.messages.saved', 'Booking saved.'))
      onSaved()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (next: BookingStatus) => {
    if (busy || !editing) return
    if (next === 'cancelled') {
      const cancel = await confirm({
        title: t('bookings.bookings.form.cancelTitle', 'Cancel this booking?'),
        text: t('bookings.bookings.form.cancelText', 'The subject becomes free on these days. You can undo it afterwards.'),
        confirmText: t('bookings.bookings.form.cancelConfirm', 'Cancel booking'),
        variant: 'destructive',
      })
      if (!cancel) return
    }
    setSaving(true)
    setRejected(null)
    try {
      const call = await post(BOOKINGS_API_PATHS.bookingActions.status, 'POST', { id: editing, status: next })
      if (!call.ok || !call.result) return reportFailure(call.result as ErrorBody | null)
      reportSuccess(
        call.result as BookingWriteResult,
        t('bookings.bookings.messages.statusChanged', 'Status changed to {status}.', {
          status: t(`bookings.bookings.status.${next}`, next),
        })
      )
      onSaved()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const conflictDetails = (conflicts: Conflict[]) =>
    conflicts
      .map((conflict) =>
        conflict.kind === 'overlap'
          ? `${conflict.withTargetName ?? t('bookings.bookings.conflictPreview.otherBooking', 'another booking')} (${daysLabel(conflict, formatDate)})`
          : `${conflict.reasonLabel ?? t('bookings.bookings.conflictPreview.unavailable', 'unavailable')} (${daysLabel(conflict, formatDate)})`
      )
      .join(', ')

  const title = editing
    ? t('bookings.bookings.edit.title', 'Edit booking')
    : composing
      ? t('bookings.bookings.composer.unavailabilityTitle', 'New unavailability')
      : t('bookings.bookings.create.title', 'New booking')

  const kindLabel = (option: ComposerKind) =>
    option === 'booking'
      ? t('bookings.bookings.composer.booking', 'Booking')
      : t('bookings.bookings.composer.unavailability', 'Unavailability')

  const bookingForm = (
    <>
      <div className="space-y-4">
        {booking ? <BookingStatusControl status={booking.status} disabled={busy} onChange={(next) => void changeStatus(next)} /> : null}
        {readOnly ? (
          <Alert status="information">
            <AlertDescription>{t('bookings.bookings.edit.closed', 'This booking is closed. Reopen it to change anything.')}</AlertDescription>
          </Alert>
        ) : null}

        <FormField label={t('bookings.bookings.form.target', 'Target')} error={translate(errors.targetId)} required>
          <Select value={values.targetId} onValueChange={(targetId) => set({ targetId })} disabled={fieldsDisabled}>
            <SelectTrigger>
              <SelectValue placeholder={t('bookings.bookings.form.pickTarget', 'Pick a target')} />
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

        <FormField label={t('bookings.bookings.form.category', 'Category')}>
          <Select
            value={categoryId ?? ALL_CATEGORIES}
            onValueChange={(next) => setCategoryId(next === ALL_CATEGORIES ? null : next)}
            disabled={fieldsDisabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>{t('bookings.bookings.form.allCategories', 'All categories')}</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('bookings.bookings.form.duration', 'Working days')} error={translate(errors.durationValue)} required>
            <Input
              type="number"
              min={0.5}
              step={0.5}
              value={values.durationValue}
              onChange={(event) => set({ durationValue: event.target.value })}
              disabled={fieldsDisabled}
            />
          </FormField>
          <FormField
            label={t('bookings.bookings.form.expectedStartOn', 'Expected start')}
            description={t(
              'bookings.bookings.form.expectedStartOnHint',
              'The latest day the booking may start. After it the target is left without cover.'
            )}
            error={translate(errors.expectedStartOn)}
            required
          >
            <Input
              type="date"
              value={values.expectedStartOn}
              onChange={(event) => set({ expectedStartOn: event.target.value })}
              disabled={fieldsDisabled}
            />
          </FormField>
        </div>

        <FormField
          label={t('bookings.bookings.form.startOn', 'Start')}
          description={
            window
              ? t('bookings.bookings.form.endsOn', 'Ends {date}', { date: formatDate(lastDayOf(window)) })
              : t(
                  'bookings.bookings.form.startOnHint',
                  'The day the subject begins the work; it fixes the place on the timeline. Leave it empty to save for later.'
                )
          }
          error={translate(errors.startOn)}
          required={Boolean(origin?.placed)}
        >
          <Input type="date" value={values.startOn} onChange={(event) => set({ startOn: event.target.value })} disabled={fieldsDisabled} />
        </FormField>

        {selectedConflicts.length > 0 && !readOnly ? (
          <Alert status="warning">
            <AlertDescription>
              {t('bookings.bookings.conflictPreview.overlap', 'On these days {subject} is already booked: {details}', {
                subject: selectedSubjectName,
                details: conflictDetails(selectedConflicts),
              })}
            </AlertDescription>
          </Alert>
        ) : null}

        <FormField
          label={t('bookings.bookings.form.subject', 'Subject')}
          description={
            origin && origin.participantCount > 1
              ? t('bookings.bookings.edit.manyParticipants', 'This booking has several participants; the subject cannot be changed here.')
              : undefined
          }
          error={translate(errors.subjectIds)}
          required
        >
          <Select
            value={values.subjectId}
            onValueChange={(subjectId) => set({ subjectId })}
            disabled={fieldsDisabled || (origin?.participantCount ?? 0) > 1}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('bookings.bookings.form.pickSubject', 'Pick a subject')} />
            </SelectTrigger>
            <SelectContent>
              {visibleSubjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {preview.busySubjectIds.has(subject.id) ? `${subject.name} · ${t('bookings.bookings.form.busy', 'busy')}` : subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          label={t('bookings.bookings.form.note', 'Note')}
          description={t('bookings.bookings.form.noteHint', 'A preferred date range goes here; there is no separate field for it yet.')}
          error={translate(errors.note)}
        >
          <Textarea value={values.note} onChange={(event) => set({ note: event.target.value })} maxLength={2000} disabled={fieldsDisabled} />
        </FormField>

        {rejected ? (
          <Alert status="error">
            <AlertDescription>{rejected}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={saving}>
          {t('bookings.actions.cancel', 'Cancel')}
        </Button>
        {editing ? (
          readOnly ? null : (
            <Button type="button" onClick={() => void saveEdit()} disabled={primaryDisabled}>
              {t('bookings.bookings.form.save', 'Save changes')}
            </Button>
          )
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={() => void create(false)} disabled={busy || !complete}>
              {t('bookings.bookings.form.saveForLater', 'Save for later')}
            </Button>
            <Button type="button" onClick={() => void create(true)} disabled={primaryDisabled}>
              {t('bookings.bookings.form.place', 'Place on timeline')}
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  )

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : void requestClose())}>
        <DialogContent
          className="max-w-xl"
          onKeyDown={(event) => {
            if (!composing && (event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              void (editing ? saveEdit() : create(true))
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          {!editing && canWriteUnavailability ? (
            <div className="inline-flex w-fit rounded-md border p-0.5" role="tablist">
              {COMPOSER_KINDS.map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  role="tab"
                  aria-selected={kind === option}
                  variant={kind === option ? 'default' : 'ghost'}
                  onClick={() => setKind(option)}
                  disabled={busy}
                >
                  {kindLabel(option)}
                </Button>
              ))}
            </div>
          ) : null}

          {composing ? (
            <UnavailabilityForm
              today={today}
              onDirtyChange={setUnavailabilityDirty}
              onCancel={() => void requestClose()}
              onSaved={() => {
                onSaved()
                onOpenChange(false)
              }}
            />
          ) : (
            bookingForm
          )}
        </DialogContent>
      </Dialog>
      {ConfirmDialogElement}
    </>
  )
}
