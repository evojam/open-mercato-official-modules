import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC_ROOT = join(__dirname, '..', '..')

const SPECIFIER = /(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"]([^'"]+)['"]/g

const BOUNDARIES = [
  { adapter: 'lib/time/date-fns.adapter.ts', packages: ['date-fns', '@date-fns/tz'] },
  { adapter: 'lib/timeline/vis-timeline.adapter.ts', packages: ['vis-timeline', 'vis-data'] },
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : []
  })
}

function importsPackage(source: string, packages: readonly string[]): boolean {
  return [...source.matchAll(SPECIFIER)].some(([, specifier]) =>
    packages.some((name) => specifier === name || specifier.startsWith(`${name}/`))
  )
}

describe.each(BOUNDARIES)('$packages stay behind $adapter', ({ adapter, packages }) => {
  const adapterPath = join(SRC_ROOT, adapter)

  it('is imported nowhere else in the package', () => {
    const offenders = sourceFiles(SRC_ROOT)
      .filter((file) => file !== adapterPath)
      .filter((file) => importsPackage(readFileSync(file, 'utf8'), packages))
      .map((file) => relative(SRC_ROOT, file))

    expect(offenders).toEqual([])
  })

  const itWhenPresent = existsSync(adapterPath) ? it : it.skip

  itWhenPresent('is imported by the adapter itself, so a renamed library cannot pass silently', () => {
    expect(importsPackage(readFileSync(adapterPath, 'utf8'), packages)).toBe(true)
  })
})

describe('the module reaches dates only through lib/time/day-ranges', () => {
  const LIB_ROOT = join(SRC_ROOT, 'lib')
  const ADAPTER = /(?:^|\/)date-fns\.adapter$/

  it('never imports the date adapter from outside src/lib, so no caller picks its own zone for a day', () => {
    const offenders = sourceFiles(SRC_ROOT)
      .filter((file) => !file.startsWith(LIB_ROOT) && !file.includes('/__tests__/'))
      .filter((file) => [...readFileSync(file, 'utf8').matchAll(SPECIFIER)].some(([, specifier]) => ADAPTER.test(specifier)))
      .map((file) => relative(SRC_ROOT, file))

    expect(offenders).toEqual([])
  })
})
