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
import { TARGETS_LIST_HREF, TargetForm, type TargetFormValues } from '../../../../components/targets/target-form.component'

type TargetRecord = TargetFormValues & { id: string }

export default function EditTargetPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const id = params?.id ?? ''
  const [record, setRecord] = React.useState<TargetRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [missing, setMissing] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const call = await apiCall<{ items: TargetRecord[] }>(`/api/bookings/targets?ids=${encodeURIComponent(id)}`)
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
          <ErrorMessage label={t('bookings.targets.errors.notFound', 'Target not found.')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        <TargetForm
          mode="edit"
          isLoading={loading}
          initialValues={record ?? undefined}
          onSubmit={async (values) => {
            try {
              await updateCrud('bookings/targets', {
                id,
                name: values.name,
                ...(values.timeZone ? { timeZone: values.timeZone } : {}),
                ...(values.color ? { color: values.color } : {}),
              })
            } catch (error) {
              throw translatedCrudError(error, t, 'bookings.targets.errors.saveFailed')
            }
            flash(t('bookings.targets.messages.saved', 'Target saved.'), 'success')
            router.push(TARGETS_LIST_HREF)
          }}
          onDelete={async () => {
            try {
              await deleteCrud('bookings/targets', id)
            } catch (error) {
              flash(translatedCrudError(error, t, 'bookings.targets.messages.deleteFailed').message, 'error')
              return
            }
            flash(t('bookings.targets.messages.deleted', 'Target deleted.'), 'success')
            router.push(TARGETS_LIST_HREF)
          }}
        />
      </PageBody>
    </Page>
  )
}
