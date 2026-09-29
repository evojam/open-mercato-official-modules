import {
  buildUnavailabilityRule,
  plannerSubjectTypeOf,
  saveUnavailability,
  unavailabilityDays,
} from '../../components/unavailability/unavailability-request'
import type { Fetcher } from '../../components/unavailability/unavailability-request'

const MEMBER_ID = '77777777-7777-4777-8777-777777777777'
const SUBJECT_ID = '33333333-3333-4333-8333-333333333333'

const base = { subjectType: 'member' as const, subjectId: MEMBER_ID, timeZone: 'Europe/Warsaw' }

describe('buildUnavailabilityRule', () => {
  it('starts at the subject midnight and lasts whole days as hours', () => {
    const rule = buildUnavailabilityRule({ ...base, from: '2026-10-05', toInclusive: '2026-10-07' })

    expect(rule).toEqual({
      subjectType: 'member',
      subjectId: MEMBER_ID,
      timezone: 'Europe/Warsaw',
      rrule: 'DTSTART:20261004T220000Z\nDURATION:PT72H\nRRULE:FREQ=DAILY;COUNT=1',
      kind: 'unavailability',
    })
  })

  it('counts the extra hour when the clocks go back inside the window', () => {
    const rule = buildUnavailabilityRule({ ...base, from: '2026-10-24', toInclusive: '2026-10-26' })

    expect(rule.rrule).toContain('DURATION:PT73H')
    expect(rule.rrule).toContain('DTSTART:20261023T220000Z')
  })

  it('takes the midnight of the subject zone, never the browser or organization one', () => {
    const rule = buildUnavailabilityRule({ ...base, timeZone: 'America/New_York', from: '2026-10-05', toInclusive: '2026-10-05' })

    expect(rule.rrule).toBe('DTSTART:20261005T040000Z\nDURATION:PT24H\nRRULE:FREQ=DAILY;COUNT=1')
  })

  it('carries the reason and a trimmed note only when given', () => {
    const rule = buildUnavailabilityRule({
      ...base,
      from: '2026-10-05',
      toInclusive: '2026-10-05',
      reason: { entryId: 'entry-1', value: 'holidays' },
      note: '  two weeks off  ',
    })

    expect(rule).toMatchObject({ unavailabilityReasonEntryId: 'entry-1', unavailabilityReasonValue: 'holidays', note: 'two weeks off' })
    expect(buildUnavailabilityRule({ ...base, from: '2026-10-05', toInclusive: '2026-10-05', note: '   ' })).not.toHaveProperty('note')
  })
})

describe('plannerSubjectTypeOf', () => {
  it('maps the two registries and refuses anything else', () => {
    expect(plannerSubjectTypeOf('staff')).toBe('member')
    expect(plannerSubjectTypeOf('resources')).toBe('resource')
    expect(plannerSubjectTypeOf('fleet')).toBeNull()
  })
})

describe('saveUnavailability', () => {
  const rule = buildUnavailabilityRule({ ...base, from: '2026-10-05', toInclusive: '2026-10-07' })
  const days = unavailabilityDays('2026-10-05', '2026-10-07')

  function fetcherWith(responses: Record<string, { ok: boolean; status: number; result: unknown }>) {
    const calls: Array<{ path: string; init?: RequestInit }> = []
    const fetcher: Fetcher = async (path, init) => {
      calls.push({ path, init })
      const key = path.split('?')[0]
      const response = responses[key] ?? { ok: false, status: 404, result: null }
      return response as { ok: boolean; status: number; result: never }
    }
    return { fetcher, calls }
  }

  it('posts the rule to the planner endpoint and then asks our conflict read for that subject and range', async () => {
    const { fetcher, calls } = fetcherWith({
      '/api/planner/availability': { ok: true, status: 201, result: { id: 'rule-1' } },
      '/api/bookings/conflicts': { ok: true, status: 200, result: { conflicts: [{ kind: 'overlap', subjectId: SUBJECT_ID }] } },
    })

    const result = await saveUnavailability(fetcher, rule, SUBJECT_ID, days)

    expect(calls[0].path).toBe('/api/planner/availability')
    expect(calls[0].init?.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual(rule)
    expect(calls[1].path).toBe(`/api/bookings/conflicts?subjectIds=${SUBJECT_ID}&from=2026-10-05&to=2026-10-08`)
    expect(result).toEqual({ ok: true, id: 'rule-1', conflicts: [{ kind: 'overlap', subjectId: SUBJECT_ID }] })
  })

  it('stops at a refused write and passes the status and reason on', async () => {
    const { fetcher, calls } = fetcherWith({
      '/api/planner/availability': { ok: false, status: 403, result: { error: 'planner.availability.errors.unauthorized' } },
    })

    const result = await saveUnavailability(fetcher, rule, SUBJECT_ID, days)

    expect(result).toEqual({ ok: false, status: 403, error: 'planner.availability.errors.unauthorized' })
    expect(calls).toHaveLength(1)
  })

  it('treats a failed conflict read as no conflicts, the window is already saved', async () => {
    const { fetcher } = fetcherWith({ '/api/planner/availability': { ok: true, status: 201, result: { id: 'rule-1' } } })

    const result = await saveUnavailability(fetcher, rule, SUBJECT_ID, days)

    expect(result).toEqual({ ok: true, id: 'rule-1', conflicts: [] })
  })
})
