export const metadata = {
  requireAuth: true,
  requireFeatures: ['reservations.view'],
  pageTitle: 'Reservations',
  pageTitleKey: 'reservations.page.title',
  pageGroup: 'Reservations',
  pageGroupKey: 'reservations.page.group',
  pageOrder: 900,
  breadcrumb: [
    { label: 'Reservations', labelKey: 'reservations.page.title' },
  ],
} as const
export default metadata
