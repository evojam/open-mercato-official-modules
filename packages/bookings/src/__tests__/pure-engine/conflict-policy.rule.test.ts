import { resolveConflictPolicy } from '../../lib/pure-engine'

const DOCTORS = 'category-doctors'
const ULTRASOUND = 'category-ultrasound'

describe('resolveConflictPolicy', () => {
  const clinic = [{ categoryId: DOCTORS, mode: 'reject' as const }]

  it('applies the organization default when no exception matches', () => {
    expect(resolveConflictPolicy('advisory', clinic, [ULTRASOUND])).toBe('advisory')
  })

  it('lets a category exception win over the default', () => {
    expect(resolveConflictPolicy('advisory', clinic, [DOCTORS])).toBe('reject')
  })

  it('takes the stricter mode when participants come from different categories', () => {
    expect(resolveConflictPolicy('advisory', clinic, [ULTRASOUND, DOCTORS])).toBe('reject')
  })

  it('can relax a strict default for one category', () => {
    const relaxed = [{ categoryId: ULTRASOUND, mode: 'advisory' as const }]

    expect(resolveConflictPolicy('reject', relaxed, [ULTRASOUND])).toBe('advisory')
    expect(resolveConflictPolicy('reject', relaxed, [ULTRASOUND, DOCTORS])).toBe('reject')
  })

  it('treats a subject with no category as the default', () => {
    expect(resolveConflictPolicy('reject', [], [null])).toBe('reject')
    expect(resolveConflictPolicy('advisory', clinic, [null])).toBe('advisory')
  })

  it('answers with the default when there are no participants', () => {
    expect(resolveConflictPolicy('advisory', clinic, [])).toBe('advisory')
  })
})
