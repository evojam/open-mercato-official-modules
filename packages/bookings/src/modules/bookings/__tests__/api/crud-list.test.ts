import { crudListQuerySchema, nameAndIdFilters, sortItemsByName } from '../../api/crud-list'

const ID_A = '6f1c2b0e-1c7a-4a52-9d3e-5b8f0d1a2c3d'

function filtersFor(query: Record<string, string>) {
  return nameAndIdFilters(crudListQuerySchema.parse(query))
}

describe('nameAndIdFilters', () => {
  it('narrows to one record for ?id=, so an edit page never falls back to the first row', () => {
    expect(filtersFor({ id: ID_A })).toEqual({ id: { $in: [ID_A] } })
  })

  it('leaves ?ids= to the platform, which drops anything that is not a uuid', () => {
    expect(filtersFor({ ids: `${ID_A},foo` })).toEqual({})
  })

  it('combines a search term with the id filter', () => {
    expect(filtersFor({ id: ID_A, search: 'mok' })).toEqual({ id: { $in: [ID_A] }, name: { $ilike: '%mok%' } })
  })

  it('filters nothing when nothing is asked', () => {
    expect(filtersFor({})).toEqual({})
  })

  it('rejects an id that is not a uuid instead of listing everything', () => {
    expect(() => crudListQuerySchema.parse({ id: 'first' })).toThrow()
  })
})

describe('sortItemsByName', () => {
  it('orders the list by name, since the unindexed list comes back in storage order', () => {
    const payload = { items: [{ name: 'Wola' }, { name: 'Bemowo' }, { name: 'Mokotów' }] }

    sortItemsByName(payload)

    expect(payload.items.map((item) => item.name)).toEqual(['Bemowo', 'Mokotów', 'Wola'])
  })
})
