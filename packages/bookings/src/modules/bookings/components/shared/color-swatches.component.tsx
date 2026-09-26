'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@open-mercato/shared/lib/utils'

export type ColorSwatchesProps = {
  colors: readonly string[]
  value: string | null
  disabled?: boolean
  labelFor: (color: string, index: number) => string
  onChange: (color: string) => void
}

export function ColorSwatches({ colors, value, disabled, labelFor, onChange }: ColorSwatchesProps) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {colors.map((color, index) => {
        const selected = value?.toLowerCase() === color
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={labelFor(color, index)}
            disabled={disabled}
            onClick={() => onChange(color)}
            className={cn(
              'flex size-8 items-center justify-center rounded-full border-2 transition-shadow focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-50',
              selected ? 'border-foreground' : 'border-transparent'
            )}
            style={{ backgroundColor: color }}
          >
            {selected ? <Check className="size-4 text-white" /> : null}
          </button>
        )
      })}
    </div>
  )
}
