import { targetsIcon } from '../../../components/shared/nav-icons'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['bookings.view'],
  pageTitle: 'Targets',
  pageTitleKey: 'bookings.targets.list.title',
  pageGroup: 'Bookings',
  pageGroupKey: 'bookings.nav.group',
  pageOrder: 20,
  icon: targetsIcon,
  breadcrumb: [{ label: 'Targets', labelKey: 'bookings.targets.list.title' }],
}
