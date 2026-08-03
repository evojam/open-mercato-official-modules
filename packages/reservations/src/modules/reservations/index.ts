import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'reservations',
  title: 'Reservations',
  description: 'Reserve a concrete subject for a target in a time window and warn when something overlaps.',
}

export { features } from './acl'
export default metadata
