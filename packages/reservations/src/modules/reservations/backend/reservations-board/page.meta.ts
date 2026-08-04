export const metadata = {
  requireAuth: true,
  requireFeatures: ['reservations.view'],
  pageTitle: 'Reservations Board',
  pageTitleKey: 'reservations.board.title',
  pageGroup: 'Reservations',
  pageGroupKey: 'reservations.page.group',
  pageOrder: 901,
  breadcrumb: [
    { label: 'Reservations Board', labelKey: 'reservations.board.title' },
  ],
} as const
export default metadata
