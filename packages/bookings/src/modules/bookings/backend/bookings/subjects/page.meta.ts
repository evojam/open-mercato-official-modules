import { subjectsIcon } from '../../../components/shared/nav-icons'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['bookings.view'],
  pageTitle: 'Subjects',
  pageTitleKey: 'bookings.subjects.list.title',
  pageGroup: 'Bookings',
  pageGroupKey: 'bookings.nav.group',
  pageOrder: 10,
  icon: subjectsIcon,
  breadcrumb: [{ label: 'Subjects', labelKey: 'bookings.subjects.list.title' }],
}
