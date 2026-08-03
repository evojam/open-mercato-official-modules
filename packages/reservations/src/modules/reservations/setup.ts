import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: [
      'reservations.view',
      'reservations.manage_reservations',
      'reservations.manage_settings',
    ],
    admin: [
      'reservations.view',
      'reservations.manage_reservations',
      'reservations.manage_settings',
    ],
    employee: ['reservations.view'],
  },
}

export default setup
