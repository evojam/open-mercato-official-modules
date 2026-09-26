import { HEX_COLOR, TARGET_PALETTE, nextPaletteColor } from '../../lib/timeline/palette'

function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return -1
  const delta = max - min
  const raw = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  return (raw * 60 + 360) % 360
}

describe('TARGET_PALETTE', () => {
  it('holds only well-formed, distinct colors', () => {
    expect(TARGET_PALETTE.every((color) => HEX_COLOR.test(color))).toBe(true)
    expect(new Set(TARGET_PALETTE).size).toBe(TARGET_PALETTE.length)
  })

  it('keeps clear of red, orange and amber, which the timeline reserves for conflicts and warnings', () => {
    const warm = TARGET_PALETTE.filter((color) => {
      const h = hue(color)
      return h >= 0 && (h < 60 || h > 320)
    })

    expect(warm).toEqual([])
  })
})

describe('nextPaletteColor', () => {
  it('starts with the first color', () => {
    expect(nextPaletteColor([])).toBe(TARGET_PALETTE[0])
  })

  it('picks the first unused color', () => {
    expect(nextPaletteColor([TARGET_PALETTE[0], TARGET_PALETTE[1]])).toBe(TARGET_PALETTE[2])
  })

  it('reuses the least-used color once the palette runs out', () => {
    const used = [...TARGET_PALETTE, ...TARGET_PALETTE.slice(0, 3)]

    expect(nextPaletteColor(used)).toBe(TARGET_PALETTE[3])
  })

  it('ignores custom colors and case', () => {
    expect(nextPaletteColor(['#FF0000', TARGET_PALETTE[0].toUpperCase(), null])).toBe(TARGET_PALETTE[1])
  })
})
