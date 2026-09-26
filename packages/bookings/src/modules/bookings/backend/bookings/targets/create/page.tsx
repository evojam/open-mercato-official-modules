'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { translatedCrudError } from '../../../../components/shared/translated-crud-error'
import { TARGETS_LIST_HREF, TargetForm } from '../../../../components/targets/target-form.component'

export default function CreateTargetPage() {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()

  return (
    <Page>
      <PageBody>
        <TargetForm
          mode="create"
          onSubmit={async (values) => {
            try {
              await createCrud('bookings/targets', {
                organizationId,
                tenantId,
                name: values.name,
                ...(values.timeZone ? { timeZone: values.timeZone } : {}),
                ...(values.color ? { color: values.color } : {}),
              })
            } catch (error) {
              throw translatedCrudError(error, t, 'bookings.targets.errors.saveFailed')
            }
            flash(t('bookings.targets.messages.created', 'Target created.'), 'success')
            router.push(TARGETS_LIST_HREF)
          }}
        />
      </PageBody>
    </Page>
  )
}
