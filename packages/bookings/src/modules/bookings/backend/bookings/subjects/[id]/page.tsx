'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { CrudForm, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { ErrorMessage } from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { supportedTimeZones } from '../../../../../../lib/time/day-ranges'
import { translatedCrudError } from '../../../../components/shared/translated-crud-error'
import { BOOKINGS_API_PATHS } from '../../../../lib/api-paths'

const SUBJECTS_LIST_HREF = '/backend/bookings/subjects'
const NO_CATEGORY = ''

type SubjectRecord = {
  id: string
  name: string
  categoryId: string | null
  timeZone: string
  isActive: boolean
}

type SubjectFormValues = {
  name: string
  categoryId: string
  timeZone: string
  isActive: boolean
}

export default function EditSubjectPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id ?? ''
  const [record, setRecord] = React.useState<SubjectRecord | null>(null)
  const [categories, setCategories] = React.useState<Array<{ value: string; label: string }>>([])
  const [loading, setLoading] = React.useState(true)
  const [missing, setMissing] = React.useState(false)
  const zones = React.useMemo(() => [...supportedTimeZones()], [])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const [subjectCall, categoriesCall] = await Promise.all([
        apiCall<{ items: SubjectRecord[] }>(`${BOOKINGS_API_PATHS.subjects}?ids=${encodeURIComponent(id)}`),
        apiCall<{ items: Array<{ id: string; name: string }> }>(BOOKINGS_API_PATHS.subjectCategories),
      ])
      if (cancelled) return
      const found = subjectCall.ok ? subjectCall.result?.items?.find((item) => item.id === id) ?? null : null
      setRecord(found)
      setMissing(!found)
      setCategories((categoriesCall.result?.items ?? []).map((category) => ({ value: category.id, label: category.name })))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'subject',
        column: 1,
        title: t('bookings.subjects.form.group', 'Subject'),
        fields: [
          {
            id: 'name',
            type: 'text',
            label: t('bookings.subjects.form.name', 'Name'),
            readOnly: true,
            description: t('bookings.subjects.form.nameHint', 'The name comes from the registry and is changed there.'),
          },
          {
            id: 'categoryId',
            type: 'select',
            label: t('bookings.subjects.form.category', 'Category'),
            options: [{ value: NO_CATEGORY, label: t('bookings.subjects.noCategory', 'No category') }, ...categories],
          },
          {
            id: 'timeZone',
            type: 'combobox',
            label: t('bookings.subjects.form.timeZone', 'Time zone'),
            suggestions: zones,
            allowCustomValues: false,
            description: t('bookings.subjects.form.timeZoneHint', "Leave and unavailability of this subject are read in its own zone."),
          },
          {
            id: 'isActive',
            type: 'checkbox',
            label: t('bookings.subjects.form.isActive', 'In use'),
          },
        ],
      },
    ],
    [categories, t, zones]
  )

  if (missing) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={t('bookings.subjects.errors.notFound', 'Subject not found.')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <CrudForm<SubjectFormValues>
          title={t('bookings.subjects.edit.title', 'Edit subject')}
          backHref={SUBJECTS_LIST_HREF}
          cancelHref={SUBJECTS_LIST_HREF}
          fields={[]}
          groups={groups}
          isLoading={loading}
          initialValues={
            record
              ? { name: record.name, categoryId: record.categoryId ?? NO_CATEGORY, timeZone: record.timeZone, isActive: record.isActive }
              : undefined
          }
          submitLabel={t('bookings.actions.save', 'Save')}
          onSubmit={async (values) => {
            try {
              await updateCrud('bookings/subjects', {
                id,
                categoryId: values.categoryId ? String(values.categoryId) : null,
                ...(values.timeZone ? { timeZone: String(values.timeZone) } : {}),
                isActive: values.isActive !== false,
              })
            } catch (error) {
              throw translatedCrudError(error, t, 'bookings.subjects.errors.saveFailed')
            }
            flash(t('bookings.subjects.messages.saved', 'Subject saved.'), 'success')
            router.push(SUBJECTS_LIST_HREF)
          }}
        />
      </PageBody>
    </Page>
  )
}
