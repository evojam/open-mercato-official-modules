export const metadata = {
  requireAuth: true,
  requireFeatures: ['bookings.manage_bookings'],
  pageTitle: 'New target',
  pageTitleKey: 'bookings.targets.create.title',
  pageGroup: 'Bookings',
  pageGroupKey: 'bookings.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Targets', labelKey: 'bookings.targets.list.title', href: '/backend/bookings/targets' },
    { label: 'New target', labelKey: 'bookings.targets.create.title' },
  ],
}
