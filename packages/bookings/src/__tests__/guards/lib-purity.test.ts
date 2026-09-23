import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const LIB_ROOT = join(__dirname, '..', '..', 'lib')

const FORBIDDEN = [
  /from\s+['"]@open-mercato\//,
  /from\s+['"]@mikro-orm\//,
  /from\s+['"]node:/,
  /from\s+['"](fs|path|crypto|os)['"]/,
  /from\s+['"]\.\.\/\.\.\/modules\//,
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : []
  })
}

describe('src/lib stays portable', () => {
  const files = sourceFiles(LIB_ROOT)

  it('holds at least one source file, so the sweep cannot pass by finding nothing', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s imports nothing that ties it to the server', (file) => {
    const source = readFileSync(file, 'utf8')
    const offenders = FORBIDDEN.filter((pattern) => pattern.test(source))

    expect(offenders).toEqual([])
  })
})
