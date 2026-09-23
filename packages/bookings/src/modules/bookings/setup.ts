import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { BookingsSettings } from './data/entities'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['bookings.*'],
    employee: ['bookings.view'],
  },

  async onTenantCreated({ em, tenantId, organizationId }) {
    const existing = await em.findOne(BookingsSettings, { tenantId, organizationId })
    if (existing) return

    const now = new Date()
    em.persist(
      em.create(
        BookingsSettings,
        {
          tenantId,
          organizationId,
          createdAt: now,
          updatedAt: now,
        },
        { partial: true }
      )
    )
    await em.flush()
  },
}
