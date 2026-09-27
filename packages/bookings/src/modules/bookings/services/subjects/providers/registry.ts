import type { SubjectProvider } from './provider'

const REGISTRY_KEY = Symbol.for('@open-mercato/bookings/subject-providers')

type GlobalWithRegistry = typeof globalThis & { [REGISTRY_KEY]?: Map<string, SubjectProvider> }

function registry(): Map<string, SubjectProvider> {
  const holder = globalThis as GlobalWithRegistry
  holder[REGISTRY_KEY] ??= new Map()
  return holder[REGISTRY_KEY]
}

export function registerSubjectProvider(provider: SubjectProvider): () => void {
  registry().set(provider.key, provider)
  return () => {
    if (registry().get(provider.key) === provider) registry().delete(provider.key)
  }
}

export function getSubjectProvider(key: string): SubjectProvider | undefined {
  return registry().get(key)
}

export function listSubjectProviders(): SubjectProvider[] {
  return [...registry().values()]
}
