'use client'

import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { ReservationsTimeline } from '../../../../ui/timeline'
import { settingsFixture, timelineRowFixtures } from '../../data/fixtures'

export default function ReservationsBoardPage() {
  const t = useT()

  return (
    <Page>
      <PageHeader
        title={t('reservations.board.title', 'Reservations Board')}
        description={t(
          'reservations.board.description',
          'SD-51 contract stage: stub timeline over fixture data.',
        )}
      />
      <PageBody>
        <ReservationsTimeline
          rows={timelineRowFixtures}
          window={{ from: '2026-08-01', to: '2026-08-31' }}
          timezone={settingsFixture.timezone}
          offWeekdays={settingsFixture.offWeekdays}
          holidays={settingsFixture.holidays}
        />
      </PageBody>
    </Page>
  )
}
