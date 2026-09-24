import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OPEN_BOOKING_STATUSES } from '../../lib/pure-engine/status.rule'

const MIGRATIONS = join(__dirname, '..', '..', 'modules', 'bookings', 'migrations')

const INDEX_PREDICATE = /bookings_bookings_open_window_idx[\s\S]*?status" in \(([^)]*)\)/

function latestMigration(): string {
  const files = readdirSync(MIGRATIONS)
    .filter((file) => file.startsWith('Migration') && file.endsWith('.ts'))
    .sort()
  return join(MIGRATIONS, files[files.length - 1])
}

describe('the open-window index matches the statuses that hold a slot', () => {
  it('lists exactly the open statuses, so a change to the lifecycle cannot drift from the schema', () => {
    const match = INDEX_PREDICATE.exec(readFileSync(latestMigration(), 'utf8'))
    expect(match).not.toBeNull()

    const inMigration = match![1]
      .split(',')
      .map((value) => value.trim().replace(/^'|'$/g, ''))
      .sort()

    expect(inMigration).toEqual([...OPEN_BOOKING_STATUSES].sort())
  })
})
