export const metadata = {
  requireAuth: true,
  requireFeatures: ['bookings.manage_settings'],
  pageTitle: 'New category',
  pageTitleKey: 'bookings.categories.create.title',
  pageGroup: 'Bookings',
  pageGroupKey: 'bookings.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Subject categories', labelKey: 'bookings.categories.list.title', href: '/backend/bookings/categories' },
    { label: 'New category', labelKey: 'bookings.categories.create.title' },
  ],
}
