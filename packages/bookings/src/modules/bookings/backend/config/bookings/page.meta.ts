import React from 'react'

const bookingsIcon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2 }),
  React.createElement('path', { d: 'M16 2v4' }),
  React.createElement('path', { d: 'M8 2v4' }),
  React.createElement('path', { d: 'M3 10h18' })
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['bookings.manage_settings'],
  pageTitle: 'Bookings',
  pageTitleKey: 'bookings.settings.nav.title',
  pageGroup: 'Module Configs',
  pageGroupKey: 'settings.sections.moduleConfigs',
  pageOrder: 40,
  icon: bookingsIcon,
  pageContext: 'settings' as const,
  breadcrumb: [{ label: 'Bookings', labelKey: 'bookings.settings.nav.title' }],
} as const
