import type { EntityManager } from '@mikro-orm/postgresql'

export async function lockSubjects(em: EntityManager, subjectIds: readonly string[]): Promise<void> {
  // A transaction-scoped lock taken outside a transaction is released at once and guards nothing.
  if (!em.isInTransaction()) throw new Error('lockSubjects must run inside the command transaction')
  for (const subjectId of [...new Set(subjectIds)].sort()) {
    await em.execute('select pg_advisory_xact_lock(hashtext(?))', [`bookings.subject:${subjectId}`])
  }
}
