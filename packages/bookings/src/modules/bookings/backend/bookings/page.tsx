import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { TimelineBoard } from '../../components/timeline/timeline-board.component'

export default function BookingsTimelinePage() {
  return (
    <Page>
      <PageBody>
        <TimelineBoard />
      </PageBody>
    </Page>
  )
}
