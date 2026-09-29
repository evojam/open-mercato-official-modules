import type { EntityManager } from '@mikro-orm/postgresql'

async function advisoryLock(em: EntityManager, key: string): Promise<void> {
  // A transaction-scoped lock taken outside a transaction is released at once and guards nothing.
  if (!em.isInTransaction()) throw new Error('advisory locks must run inside the command transaction')
  await em.execute('select pg_advisory_xact_lock(hashtext(?))', [key])
}

export async function lockTarget(em: EntityManager, targetId: string): Promise<void> {
  await advisoryLock(em, `bookings.target:${targetId}`)
}

export async function lockSubjects(em: EntityManager, subjectIds: readonly string[]): Promise<void> {
  for (const subjectId of [...new Set(subjectIds)].sort()) await advisoryLock(em, `bookings.subject:${subjectId}`)
}
