import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { BookingsSettingsScreen } from '../../../components/settings/settings-screen.component'

export default function BookingsSettingsPage() {
  return (
    <Page>
      <PageBody className="space-y-8">
        <BookingsSettingsScreen />
      </PageBody>
    </Page>
  )
}
