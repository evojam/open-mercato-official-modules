export const metadata = {
  requireAuth: true,
  requireFeatures: ['bookings.manage_bookings'],
  pageTitle: 'Edit target',
  pageTitleKey: 'bookings.targets.edit.title',
  pageGroup: 'Bookings',
  pageGroupKey: 'bookings.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Targets', labelKey: 'bookings.targets.list.title', href: '/backend/bookings/targets' },
    { label: 'Edit target', labelKey: 'bookings.targets.edit.title' },
  ],
}
