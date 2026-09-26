export const metadata = {
  requireAuth: true,
  requireFeatures: ['bookings.manage_settings'],
  pageTitle: 'Edit category',
  pageTitleKey: 'bookings.categories.edit.title',
  pageGroup: 'Bookings',
  pageGroupKey: 'bookings.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Subject categories', labelKey: 'bookings.categories.list.title', href: '/backend/bookings/categories' },
    { label: 'Edit category', labelKey: 'bookings.categories.edit.title' },
  ],
}
