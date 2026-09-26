'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { ErrorMessage } from '@open-mercato/ui/backend/detail'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { translatedCrudError } from '../../../../components/shared/translated-crud-error'
import {
  CATEGORIES_LIST_HREF,
  CategoryForm,
  type CategoryFormValues,
} from '../../../../components/subjects/category-form.component'

type CategoryRecord = CategoryFormValues & { id: string }

export default function EditCategoryPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id ?? ''
  const [record, setRecord] = React.useState<CategoryRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [missing, setMissing] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const call = await apiCall<{ items: CategoryRecord[] }>(`/api/bookings/subject-categories?ids=${encodeURIComponent(id)}`)
      if (cancelled) return
      const found = call.ok ? call.result?.items?.find((item) => item.id === id) ?? null : null
      setRecord(found)
      setMissing(!found)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (missing) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={t('bookings.categories.errors.notFound', 'Category not found.')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <CategoryForm
          mode="edit"
          isLoading={loading}
          initialValues={record ?? undefined}
          onSubmit={async (values) => {
            try {
              await updateCrud('bookings/subject-categories', {
                id,
                name: values.name,
                icon: values.icon,
                ...(values.color ? { color: values.color } : {}),
              })
            } catch (error) {
              throw translatedCrudError(error, t, 'bookings.categories.errors.saveFailed')
            }
            flash(t('bookings.categories.messages.saved', 'Category saved.'), 'success')
            router.push(CATEGORIES_LIST_HREF)
          }}
          onDelete={async () => {
            try {
              await deleteCrud('bookings/subject-categories', id)
            } catch (error) {
              flash(translatedCrudError(error, t, 'bookings.categories.messages.deleteFailed').message, 'error')
              return
            }
            flash(t('bookings.categories.messages.deleted', 'Category deleted.'), 'success')
            router.push(CATEGORIES_LIST_HREF)
          }}
        />
      </PageBody>
    </Page>
  )
}
