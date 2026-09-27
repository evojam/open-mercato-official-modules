export const metadata = {
  requireAuth: true,
  requireFeatures: ['bookings.manage_bookings'],
  pageTitle: 'Edit subject',
  pageTitleKey: 'bookings.subjects.edit.title',
  pageGroup: 'Bookings',
  pageGroupKey: 'bookings.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Subjects', labelKey: 'bookings.subjects.list.title', href: '/backend/bookings/subjects' },
    { label: 'Edit subject', labelKey: 'bookings.subjects.edit.title' },
  ],
}
