import { defineRegistryProvider } from './query-provider'

export const RESOURCES_PROVIDER_KEY = 'resources'
export const STAFF_PROVIDER_KEY = 'staff'
export const STAFF_TEAMS_PROVIDER_KEY = 'staff_teams'

export const resourcesSubjectProvider = defineRegistryProvider({
  key: RESOURCES_PROVIDER_KEY,
  kind: 'resource',
  labelKey: 'bookings.subjects.providers.resources',
  entityId: 'resources:resources_resource',
  nameField: 'name',
  createCommand: 'resources.resources.create',
  createFeature: 'resources.manage_resources',
  createInput: (name) => ({ name }),
  createdId: (result) => (result as { resourceId?: string } | null)?.resourceId ?? null,
  cardHref: (recordId) => `/backend/resources/resources/${recordId}`,
})

export const staffSubjectProvider = defineRegistryProvider({
  key: STAFF_PROVIDER_KEY,
  kind: 'person',
  labelKey: 'bookings.subjects.providers.staff',
  entityId: 'staff:staff_team_member',
  nameField: 'display_name',
  createCommand: 'staff.team-members.create',
  createFeature: 'staff.manage_team',
  createInput: (name) => ({ displayName: name }),
  createdId: (result) => (result as { memberId?: string } | null)?.memberId ?? null,
  cardHref: (recordId) => `/backend/staff/team-members/${recordId}`,
})

export const staffTeamsSubjectProvider = defineRegistryProvider({
  key: STAFF_TEAMS_PROVIDER_KEY,
  kind: 'team',
  labelKey: 'bookings.subjects.providers.staff_teams',
  entityId: 'staff:staff_team',
  nameField: 'name',
  createCommand: 'staff.teams.create',
  createFeature: 'staff.manage_team',
  createInput: (name) => ({ name }),
  createdId: (result) => (result as { teamId?: string } | null)?.teamId ?? null,
  cardHref: (recordId) => `/backend/staff/teams/${recordId}`,
})
