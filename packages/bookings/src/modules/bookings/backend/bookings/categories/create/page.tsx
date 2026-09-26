'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { translatedCrudError } from '../../../../components/shared/translated-crud-error'
import { CATEGORIES_LIST_HREF, CategoryForm } from '../../../../components/subjects/category-form.component'

export default function CreateCategoryPage() {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()

  return (
    <Page>
      <PageBody>
        <CategoryForm
          mode="create"
          onSubmit={async (values) => {
            try {
              await createCrud('bookings/subject-categories', {
                organizationId,
                tenantId,
                name: values.name,
                icon: values.icon,
                ...(values.color ? { color: values.color } : {}),
              })
            } catch (error) {
              throw translatedCrudError(error, t, 'bookings.categories.errors.saveFailed')
            }
            flash(t('bookings.categories.messages.created', 'Category created.'), 'success')
            router.push(CATEGORIES_LIST_HREF)
          }}
        />
      </PageBody>
    </Page>
  )
}
