import { timelineIcon } from '../../components/shared/nav-icons'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['bookings.view'],
  pageTitle: 'Timeline',
  pageTitleKey: 'bookings.timeline.title',
  pageGroup: 'Bookings',
  pageGroupKey: 'bookings.nav.group',
  pageOrder: 0,
  icon: timelineIcon,
  breadcrumb: [{ label: 'Timeline', labelKey: 'bookings.timeline.title' }],
}
