import * as React from 'react'

const HATCH_BACKGROUND = 'repeating-linear-gradient(45deg, var(--border) 0 2px, transparent 2px 5px)'

export type TimelineLegendLabels = {
  conflict: string
  unavailable: string
  free: string
  done: string
  now: string
}

function LegendItem({ label, swatch }: { label: string; swatch: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
      {swatch}
      {label}
    </span>
  )
}

export function TimelineLegend({ labels }: { labels: TimelineLegendLabels }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-4 border-b bg-muted/25 px-5 py-2">
      <div className="flex flex-wrap items-center gap-3.5">
        <LegendItem label={labels.conflict} swatch={<span className="h-2.5 w-4 shrink-0 rounded-sm bg-destructive" />} />
        <LegendItem
          label={labels.unavailable}
          swatch={
            <span className="h-2.5 w-4 shrink-0 rounded-sm border border-dashed" style={{ background: HATCH_BACKGROUND }} />
          }
        />
        <LegendItem label={labels.free} swatch={<span className="h-2.5 w-4 shrink-0 rounded-sm border bg-card" />} />
        <LegendItem
          label={labels.done}
          swatch={<span className="h-2.5 w-4 shrink-0 rounded-sm border border-dashed bg-muted/55" />}
        />
        <LegendItem label={labels.now} swatch={<span className="h-3 w-0.5 shrink-0 bg-foreground" />} />
      </div>
    </div>
  )
}
