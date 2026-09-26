import { crudListQuerySchema, nameAndIdFilters } from '../../api/crud-list'

const ID_A = '6f1c2b0e-1c7a-4a52-9d3e-5b8f0d1a2c3d'
const ID_B = '0b9e8d7c-6a5b-4c3d-8e2f-1a0b9c8d7e6f'

function filtersFor(query: Record<string, string>) {
  return nameAndIdFilters(crudListQuerySchema.parse(query))
}

describe('nameAndIdFilters', () => {
  it('narrows to one record for ?id=, so an edit page never falls back to the first row', () => {
    expect(filtersFor({ id: ID_A })).toEqual({ id: { $in: [ID_A] } })
  })

  it('narrows to the listed records for ?ids=', () => {
    expect(filtersFor({ ids: `${ID_A}, ${ID_B}` })).toEqual({ id: { $in: [ID_A, ID_B] } })
  })

  it('combines a search term with the id filter', () => {
    expect(filtersFor({ ids: ID_A, search: 'mok' })).toEqual({ id: { $in: [ID_A] }, name: { $ilike: '%mok%' } })
  })

  it('filters nothing when nothing is asked', () => {
    expect(filtersFor({})).toEqual({})
  })

  it('rejects an id that is not a uuid instead of listing everything', () => {
    expect(() => crudListQuerySchema.parse({ id: 'first' })).toThrow()
  })
})
