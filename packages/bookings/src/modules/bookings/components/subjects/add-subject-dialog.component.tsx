'use client'

import * as React from 'react'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Alert, AlertDescription } from '@open-mercato/ui/primitives/alert'
import { Button } from '@open-mercato/ui/primitives/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@open-mercato/ui/primitives/dialog'
import { FormField } from '@open-mercato/ui/primitives/form-field'
import { Input } from '@open-mercato/ui/primitives/input'
import { RadioGroup } from '@open-mercato/ui/primitives/radio'
import { RadioField } from '@open-mercato/ui/primitives/radio-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@open-mercato/ui/primitives/tabs'
import { BOOKINGS_API_PATHS } from '../../lib/api-paths'
import type { ProviderRecord, SubjectKind } from '../../services/subjects/providers/provider'

export type SubjectProviderOption = {
  key: string
  kind: SubjectKind
  labelKey: string
  canCreate: boolean
}

export type SubjectCategoryOption = {
  id: string
  name: string
}

type Mode = 'new' | 'existing'

type Orphan = { providerKey: string; providerRecordId: string }

type ErrorBody = { error?: string; code?: string; details?: Partial<Orphan> }

export type AddSubjectDialogProps = {
  open: boolean
  providers: readonly SubjectProviderOption[]
  categories: readonly SubjectCategoryOption[]
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}

const NO_CATEGORY = '__none__'

export function AddSubjectDialog({ open, providers, categories, onOpenChange, onAdded }: AddSubjectDialogProps) {
  const t = useT()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const [mode, setMode] = React.useState<Mode>('new')
  const [providerKey, setProviderKey] = React.useState('')
  const [name, setName] = React.useState('')
  const [categoryId, setCategoryId] = React.useState(NO_CATEGORY)
  const [search, setSearch] = React.useState('')
  const [candidates, setCandidates] = React.useState<ProviderRecord[]>([])
  const [picked, setPicked] = React.useState<string | null>(null)
  const [orphan, setOrphan] = React.useState<Orphan | null>(null)
  const [saving, setSaving] = React.useState(false)

  const provider = providers.find((option) => option.key === providerKey)
  const canCreate = provider?.canCreate ?? false

  React.useEffect(() => {
    if (!open) return
    const first = providers[0]
    setProviderKey(first?.key ?? '')
    setMode(first?.canCreate ? 'new' : 'existing')
    setName('')
    setCategoryId(NO_CATEGORY)
    setSearch('')
    setPicked(null)
    setOrphan(null)
  }, [open, providers])

  React.useEffect(() => {
    if (!canCreate && mode === 'new') setMode('existing')
  }, [canCreate, mode])

  React.useEffect(() => {
    setCandidates([])
    setPicked(null)
    if (!open || mode !== 'existing' || !providerKey) return
    let cancelled = false
    const handle = setTimeout(() => {
      void (async () => {
        const params = new URLSearchParams({ providerKey, pageSize: '20' })
        if (search.trim()) params.set('search', search.trim())
        const call = await apiCall<{ items: ProviderRecord[] }>(`${BOOKINGS_API_PATHS.subjectCandidates}?${params.toString()}`)
        if (cancelled) return
        if (call.ok) setCandidates(call.result?.items ?? [])
        else flash(t('bookings.subjects.errors.candidatesFailed', 'Failed to load records from the registry.'), 'error')
      })()
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [open, mode, providerKey, search, t])

  const submit = async (body: Record<string, unknown>) => {
    setSaving(true)
    try {
      const call = await apiCall<ErrorBody>(BOOKINGS_API_PATHS.subjects, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          tenantId,
          categoryId: categoryId === NO_CATEGORY ? null : categoryId,
          ...body,
        }),
      })
      if (call.ok) {
        flash(t('bookings.subjects.messages.added', 'Subject added.'), 'success')
        onAdded()
        onOpenChange(false)
        return
      }
      const error = call.result
      if (error?.code === 'provider_record_orphaned' && error.details?.providerKey && error.details.providerRecordId) {
        setOrphan({ providerKey: error.details.providerKey, providerRecordId: error.details.providerRecordId })
      }
      const message = error?.error ?? 'bookings.subjects.errors.addFailed'
      flash(t(message, message), 'error')
    } finally {
      setSaving(false)
    }
  }

  const ready = Boolean(providerKey) && (mode === 'new' ? canCreate && name.trim().length > 0 : picked !== null)
  const confirm = () => {
    if (saving) return
    if (orphan) return void submit({ mode: 'existing', ...orphan })
    if (!ready) return
    if (mode === 'new') return void submit({ mode: 'new', providerKey, name: name.trim() })
    return void submit({ mode: 'existing', providerKey, providerRecordId: picked })
  }

  const kindLabel = (kind: SubjectKind) =>
    kind === 'person' ? t('bookings.subjects.kind.person', 'Person') : t('bookings.subjects.kind.resource', 'Equipment, room or vehicle')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            confirm()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('bookings.subjects.add.title', 'Add a subject')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <FormField label={t('bookings.subjects.add.kind', 'What is it?')}>
            <RadioGroup
              value={providerKey}
              onValueChange={(next) => {
                setProviderKey(next)
                setOrphan(null)
              }}
              disabled={saving}
              className="grid grid-cols-2 gap-2"
            >
              {providers.map((option) => (
                <RadioField key={option.key} value={option.key} label={kindLabel(option.kind)} sublabel={t(option.labelKey, option.key)} />
              ))}
            </RadioGroup>
          </FormField>

          <Tabs value={mode} onValueChange={(value) => setMode(value === 'existing' ? 'existing' : 'new')}>
            <TabsList>
              <TabsTrigger value="new" disabled={!canCreate}>
                {t('bookings.subjects.add.new', 'New')}
              </TabsTrigger>
              <TabsTrigger value="existing">{t('bookings.subjects.add.existing', 'Already registered')}</TabsTrigger>
            </TabsList>
            <TabsContent value="new" className="pt-3">
              <FormField
                label={t('bookings.subjects.add.name', 'Name')}
                description={t('bookings.subjects.add.newHint', 'The record is created in the registry first, then added here.')}
                required
              >
                <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} disabled={saving} autoFocus />
              </FormField>
            </TabsContent>
            <TabsContent value="existing" className="space-y-2 pt-3">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('bookings.subjects.add.search', 'Search the registry')}
                disabled={saving}
              />
              <div role="listbox" className="max-h-64 space-y-1 overflow-y-auto">
                {candidates.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">{t('bookings.subjects.add.noCandidates', 'Nothing left to add from this registry.')}</p>
                ) : null}
                {candidates.map((candidate) => (
                  <button
                    key={candidate.recordId}
                    type="button"
                    role="option"
                    aria-selected={picked === candidate.recordId}
                    onClick={() => setPicked(candidate.recordId)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:shadow-focus',
                      picked === candidate.recordId ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'
                    )}
                  >
                    <span className="truncate">{candidate.name}</span>
                    {candidate.isActive ? null : (
                      <span className="text-xs text-muted-foreground">{t('bookings.subjects.inactive', 'Inactive')}</span>
                    )}
                  </button>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <FormField label={t('bookings.subjects.add.category', 'Category')}>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={saving}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>{t('bookings.subjects.noCategory', 'No category')}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {orphan ? (
            <Alert status="warning">
              <AlertDescription>
                {t(
                  'bookings.subjects.add.orphan',
                  'The record was created in the registry, but adding it here failed. Confirm to attach that record instead of creating a second one.'
                )}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('bookings.actions.cancel', 'Cancel')}
          </Button>
          <Button type="button" onClick={confirm} disabled={saving || (!orphan && !ready)}>
            {orphan ? t('bookings.subjects.add.attachOrphan', 'Attach created record') : t('bookings.subjects.add.submit', 'Add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
