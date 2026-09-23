import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'bookings',
  title: 'Bookings',
  version: '0.1.0',
  description: 'Occupies a subject for a target over a time window — conflict detection, coverage warnings and a resource-lane timeline.',
  author: 'Evojam',
  license: 'MIT',
  requires: ['staff', 'scheduler'],
  ejectable: true,
}

export { features } from './acl'

export default metadata
