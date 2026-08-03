import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['reservations.view'],
    admin: ['reservations.view'],
  },
}

export default setup
