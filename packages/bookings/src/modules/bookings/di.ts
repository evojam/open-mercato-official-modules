import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import { resourcesSubjectProvider, staffSubjectProvider } from './services/subjects/providers/builtin.providers'
import { registerSubjectProvider } from './services/subjects/providers/registry'

export function register(_container: AppContainer) {
  registerSubjectProvider(resourcesSubjectProvider)
  registerSubjectProvider(staffSubjectProvider)
}
