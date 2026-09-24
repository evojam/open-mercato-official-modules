import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const LIB_ROOT = join(__dirname, '..', '..', 'lib')

const SPECIFIER = /(?:from\s*|import\s*|require\s*\(\s*)['"]([^'"]+)['"]/g

const ALLOWED_PACKAGES = ['react', 'react-dom', 'react/jsx-runtime']

const CLOCK = [
  { pattern: /\bDate\.now\s*\(/, name: 'Date.now()' },
  { pattern: /new\s+Date\s*\(\s*\)/, name: 'new Date()' },
  { pattern: /\bMath\.random\s*\(/, name: 'Math.random()' },
  { pattern: /\bperformance\.now\s*\(/, name: 'performance.now()' },
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : []
  })
}

function specifiersOf(source: string): string[] {
  return [...source.matchAll(SPECIFIER)].map((match) => match[1])
}

function isPortable(specifier: string): boolean {
  if (specifier.startsWith('.')) return !specifier.includes('modules/')
  return ALLOWED_PACKAGES.includes(specifier)
}

describe('src/lib stays portable', () => {
  const files = sourceFiles(LIB_ROOT)

  it('holds source files, so the sweep cannot pass by finding nothing', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s imports nothing that ties it to the server', (file) => {
    const offenders = specifiersOf(readFileSync(file, 'utf8')).filter(
      (specifier) => !isPortable(specifier)
    )

    expect(offenders).toEqual([])
  })

  it.each(files)('%s asks nothing about the current moment', (file) => {
    const source = readFileSync(file, 'utf8')
    const offenders = CLOCK.filter(({ pattern }) => pattern.test(source)).map(({ name }) => name)

    expect(offenders).toEqual([])
  })
})
