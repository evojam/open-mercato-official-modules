export const TARGET_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#7c3aed',
  '#0891b2',
  '#4f46e5',
  '#65a30d',
  '#9333ea',
  '#0d9488',
  '#0284c7',
  '#059669',
  '#475569',
  '#1e40af',
] as const

export const HEX_COLOR = /^#[0-9a-f]{6}$/

export function nextPaletteColor(usedColors: readonly (string | null | undefined)[]): string {
  const usage = new Map<string, number>(TARGET_PALETTE.map((color) => [color, 0]))
  for (const color of usedColors) {
    const key = color?.toLowerCase()
    if (key && usage.has(key)) usage.set(key, (usage.get(key) ?? 0) + 1)
  }
  let pick: string = TARGET_PALETTE[0]
  for (const color of TARGET_PALETTE) {
    if ((usage.get(color) ?? 0) < (usage.get(pick) ?? 0)) pick = color
  }
  return pick
}
