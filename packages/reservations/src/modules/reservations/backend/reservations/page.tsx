'use client'

import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function ReservationsPage() {
  const t = useT()

  return (
    <Page>
      <PageHeader
        title={t('reservations.page.title', 'Reservations')}
        description={t('reservations.page.description', 'Reserve a concrete subject for a target in a time window and warn when something overlaps.')}
      />
      <PageBody>
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-base font-semibold">
            {t('reservations.page.cardTitle', 'Module is wired correctly')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              'reservations.page.cardDescription',
              'If this page renders, the package build, module discovery, and backend routing are working.',
            )}
          </p>
        </div>
      </PageBody>
    </Page>
  )
}
