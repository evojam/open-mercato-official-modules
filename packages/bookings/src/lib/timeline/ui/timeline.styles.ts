export const TIMELINE_ROOT_CLASS = 'bookings-timeline'

export const TIMELINE_CSS = `
.bookings-timeline {
  --tl-radius: 6px;
  --tl-row-height: 48px;
  --tl-bg: var(--background);
  --tl-surface: var(--card);
  --tl-fg: var(--foreground);
  --tl-fg-muted: var(--muted-foreground);
  --tl-border: var(--border);
  --tl-border-strong: color-mix(in oklab, var(--border), var(--foreground) 14%);
  --tl-item-bg: var(--muted);
  --tl-item-shadow: 0 1px 2px color-mix(in oklab, var(--foreground) 12%, transparent);
  --tl-weekend-bg: color-mix(in oklab, var(--foreground) 4%, transparent);
  --tl-holiday-bg: color-mix(in oklab, var(--foreground) 7%, transparent);
  --tl-done-bg: color-mix(in oklab, var(--muted), var(--foreground) 3%);
  --tl-unavailable-a: color-mix(in oklab, var(--foreground) 11%, transparent);
  --tl-unavailable-b: color-mix(in oklab, var(--foreground) 3%, transparent);
  --tl-conflict-bg: var(--destructive);
  --tl-conflict-border: color-mix(in oklab, var(--destructive), black 18%);
  --tl-conflict-fg: oklch(0.985 0 0);
  --tl-conflict-stripe-a: color-mix(in oklab, var(--destructive), white 8%);
  --tl-conflict-stripe-b: color-mix(in oklab, var(--destructive), black 16%);

  background: var(--tl-bg);
  border-top: 1px solid var(--tl-border);
  overflow: auto;
  flex: 1 1 auto;
  min-height: 0;
}

.bookings-timeline .vis-timeline {
  border: none;
  font-family: var(--font-sans, inherit);
  color: var(--tl-fg);
  background: var(--tl-bg);
}
.bookings-timeline .vis-panel.vis-center,
.bookings-timeline .vis-panel.vis-left,
.bookings-timeline .vis-panel.vis-right,
.bookings-timeline .vis-panel.vis-top,
.bookings-timeline .vis-panel.vis-bottom {
  border-color: var(--tl-border);
}
.bookings-timeline .vis-panel .vis-shadow {
  box-shadow: none;
}

.bookings-timeline .vis-time-axis .vis-grid.vis-minor {
  border-color: var(--tl-border);
}
.bookings-timeline .vis-time-axis .vis-grid.vis-major {
  border-color: var(--tl-border-strong);
}
.bookings-timeline .vis-time-axis .vis-text {
  color: var(--tl-fg-muted);
}
.bookings-timeline .vis-time-axis .vis-text.vis-major {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.bookings-timeline .vis-time-axis .vis-text.vis-minor {
  white-space: pre-line;
  text-align: center;
  line-height: 1.15;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.bookings-timeline .vis-time-axis .vis-text.vis-minor.vis-measure {
  min-height: 2.8em;
}

.bookings-timeline .vis-labelset .vis-label {
  color: var(--tl-fg);
  background: var(--tl-surface);
  border-color: var(--tl-border);
  display: flex;
  align-items: center;
}
.bookings-timeline .vis-labelset .vis-label .vis-inner {
  padding: 0 12px;
  font-size: 13px;
  font-weight: 500;
}
.bookings-timeline .vis-labelset .vis-label.tl-inactive .vis-inner {
  color: var(--tl-fg-muted);
  font-style: italic;
}
.bookings-timeline .vis-foreground .vis-group {
  border-color: var(--tl-border);
}
.bookings-timeline .vis-labelset .vis-label,
.bookings-timeline .vis-foreground .vis-group {
  min-height: var(--tl-row-height);
  box-sizing: border-box;
}
.bookings-timeline .vis-panel.vis-left {
  background: var(--tl-surface);
}

.bookings-timeline .vis-custom-time.tl-now {
  background-color: var(--tl-fg);
  width: 2px;
  opacity: 0.85;
  pointer-events: none;
}

.bookings-timeline .vis-item.vis-range {
  display: flex;
  align-items: center;
  min-height: 26px;
  box-sizing: border-box;
  border-radius: var(--tl-radius);
  border-width: 1px;
  border-style: solid;
  background-color: var(--tl-item-bg);
  border-color: var(--tl-border-strong);
  color: var(--tl-fg);
  box-shadow: var(--tl-item-shadow);
}
.bookings-timeline .vis-item.vis-range .vis-item-content {
  padding: 0 9px;
  line-height: 1.2;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bookings-timeline .vis-item.vis-background.tl-weekend {
  background: var(--tl-weekend-bg);
}
.bookings-timeline .vis-item.vis-background.tl-holiday {
  background: var(--tl-holiday-bg);
}

.bookings-timeline .vis-item.vis-range.tl-done {
  background: var(--tl-done-bg);
  border-style: dashed;
  border-color: var(--tl-border-strong);
  color: var(--tl-fg-muted);
  box-shadow: none;
}

.bookings-timeline .vis-item.vis-range.tl-unavailable {
  background: repeating-linear-gradient(135deg, var(--tl-unavailable-a) 0 7px, var(--tl-unavailable-b) 7px 14px);
  border-color: var(--tl-border-strong);
  color: var(--tl-fg);
}
.bookings-timeline .vis-item.vis-range.tl-unavailable.tl-conflict {
  background: repeating-linear-gradient(135deg, var(--tl-conflict-stripe-a) 0 7px, var(--tl-conflict-stripe-b) 7px 14px);
  border-color: var(--tl-conflict-border);
  color: var(--tl-conflict-fg);
}
.bookings-timeline .vis-item.vis-range.tl-conflict {
  background: var(--tl-conflict-bg);
  border-color: var(--tl-conflict-border);
  color: var(--tl-conflict-fg);
}

/* Last on purpose: every variant above sets its own box-shadow at the same specificity. */
.bookings-timeline .vis-item.vis-range.vis-selected {
  box-shadow: 0 0 0 2px var(--tl-fg);
}

.bookings-timeline .vis-tooltip {
  white-space: pre-line;
}

.bookings-timeline .tl-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.bookings-timeline .tl-row-swatch {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 2px;
}
.bookings-timeline .tl-row-badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
}
.bookings-timeline .tl-row-badge svg {
  width: 14px;
  height: 14px;
}
`
