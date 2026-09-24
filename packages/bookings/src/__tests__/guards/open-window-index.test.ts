import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OPEN_BOOKING_STATUSES } from '../../lib/pure-engine/status.rule'

const SNAPSHOT = join(
  __dirname,
  '..',
  '..',
  'modules',
  'bookings',
  'migrations',
  '.snapshot-open-mercato.json'
)

const INDEX_PREDICATE = /bookings_bookings_open_window_idx[\s\S]{0,400}?status\\" in \(([^)]*)\)/

describe('the open-window index matches the statuses that hold a slot', () => {
  it('lists exactly the open statuses, so a change to the lifecycle cannot drift from the schema', () => {
    const match = INDEX_PREDICATE.exec(readFileSync(SNAPSHOT, 'utf8'))
    expect(match).not.toBeNull()

    const inSchema = match![1]
      .split(',')
      .map((value) => value.trim().replace(/^'|'$/g, ''))
      .sort()

    expect(inSchema).toEqual([...OPEN_BOOKING_STATUSES].sort())
  })
})
