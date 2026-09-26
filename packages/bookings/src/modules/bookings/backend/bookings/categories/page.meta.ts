import { categoriesIcon } from '../../../components/shared/nav-icons'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['bookings.view'],
  pageTitle: 'Subject categories',
  pageTitleKey: 'bookings.categories.list.title',
  pageGroup: 'Bookings',
  pageGroupKey: 'bookings.nav.group',
  pageOrder: 30,
  icon: categoriesIcon,
  breadcrumb: [{ label: 'Subject categories', labelKey: 'bookings.categories.list.title' }],
}
