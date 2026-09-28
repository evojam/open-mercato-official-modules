import type { DataGroup, DataItem, IdType, MomentConstructor1, TimelineOptions } from 'vis-timeline/standalone'
import { isWorkingDay } from '../pure-engine/working-days.rule'
import { addDays } from '../time/date-fns.adapter'
import type { DayRange, IsoDate } from '../time/types'
import { daysIn, freeDaysIn } from './layout/range'
import type {
  RowIconHost,
  TimelineBar,
  TimelineHandle,
  TimelineMountOptions,
  TimelineRow,
  TimelineUnavailability,
  TimelineView,
} from './types'

type VisModule = typeof import('vis-timeline/standalone') & { moment: MomentConstructor1 }

let loading: Promise<VisModule> | null = null

function loadVis(): Promise<VisModule> {
  loading ??= (import('vis-timeline/standalone') as Promise<VisModule>).catch((error: unknown) => {
    loading = null
    throw error
  })
  return loading
}

const NOW_MARKER = 'tl-now'
const UNAVAILABILITY_PREFIX = 'window:'
const FREE_DAY_PREFIX = 'free:'
const FREE_DAY_OVERLAY = 'rgba(0,0,0,0.35)'

function toAxis(date: IsoDate): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// A DOM node, not a string: vis-timeline runs its XSS filter over string content and drops the inline colour.
function rowContent(row: TimelineRow, hosts: RowIconHost[]): string | HTMLElement {
  if (!row.color && !row.iconName) return escapeHtml(row.label)
  const wrapper = document.createElement('span')
  wrapper.className = 'tl-row'
  if (row.iconName) {
    const badge = document.createElement('span')
    badge.className = 'tl-row-badge'
    if (row.color) {
      badge.style.background = `color-mix(in oklab, ${row.color} 14%, transparent)`
      badge.style.color = row.color
    }
    wrapper.append(badge)
    hosts.push({ rowId: row.id, node: badge })
  } else if (row.color) {
    const swatch = document.createElement('span')
    swatch.className = 'tl-row-swatch'
    swatch.style.background = row.color
    wrapper.append(swatch)
  }
  wrapper.append(document.createTextNode(row.label))
  return wrapper
}

function groupsOf(view: TimelineView, hosts: RowIconHost[]): DataGroup[] {
  return view.rows.map((row) => ({
    id: row.id,
    content: rowContent(row, hosts),
    title: row.title ? escapeHtml(row.title) : undefined,
    className: row.inactive ? 'tl-inactive' : undefined,
  }))
}

function freeDayOverlay(bar: DayRange, view: TimelineView): string | null {
  const flags = daysIn(bar).map((day) => !isWorkingDay(day, view.calendar))
  if (!flags.some(Boolean)) return null
  const segment = 100 / flags.length
  const stops = flags.map(
    (free, index) => `${free ? FREE_DAY_OVERLAY : 'transparent'} ${index * segment}% ${(index + 1) * segment}%`
  )
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

function barStyle(bar: TimelineBar, view: TimelineView): string | undefined {
  if (bar.tone !== 'normal' || !bar.color) return undefined
  const overlay = freeDayOverlay(bar, view)
  const background = overlay ? `${overlay}, ${bar.color}` : bar.color
  return `background:${background};background-origin:border-box;border-color:${bar.color};color:#fff`
}

function barClass(bar: TimelineBar): string | undefined {
  if (bar.tone === 'conflict') return 'tl-conflict'
  if (bar.tone === 'done') return 'tl-done'
  return undefined
}

function unavailabilityItem(window: TimelineUnavailability): DataItem {
  return {
    id: `${UNAVAILABILITY_PREFIX}${window.id}`,
    group: window.rowId,
    type: 'range',
    start: toAxis(window.from),
    end: toAxis(window.to),
    content: escapeHtml(window.label),
    title: escapeHtml(window.label),
    className: window.conflict ? 'tl-unavailable tl-conflict' : 'tl-unavailable',
  }
}

function itemsOf(view: TimelineView): DataItem[] {
  return [
    ...view.bars.map((bar) => ({
      id: bar.id,
      group: bar.rowId,
      type: 'range' as const,
      start: toAxis(bar.from),
      end: toAxis(bar.to),
      content: escapeHtml(bar.label),
      title: escapeHtml(bar.title),
      className: barClass(bar),
      style: barStyle(bar, view),
    })),
    ...view.unavailability.map(unavailabilityItem),
    ...freeDaysIn(view.window, view.calendar).map((day) => ({
      id: `${FREE_DAY_PREFIX}${day.date}`,
      type: 'background' as const,
      start: toAxis(day.date),
      end: toAxis(addDays(day.date, 1)),
      content: '',
      className: day.kind === 'holiday' ? 'tl-holiday' : 'tl-weekend',
    })),
  ]
}

function windowOptions(window: DayRange, widthPx: number): TimelineOptions {
  const start = toAxis(window.from)
  const end = toAxis(window.to)
  return { start, end, min: start, max: end, width: `${widthPx}px` }
}

function isBar(id: IdType): boolean {
  const value = String(id)
  return !value.startsWith(UNAVAILABILITY_PREFIX) && !value.startsWith(FREE_DAY_PREFIX)
}

export async function mountTimeline(
  container: HTMLElement,
  view: TimelineView,
  options: TimelineMountOptions
): Promise<TimelineHandle> {
  const { Timeline, moment } = await loadVis()
  const weekday = new Intl.DateTimeFormat(options.locale, { weekday: 'short', timeZone: 'UTC' })
  const month = new Intl.DateTimeFormat(options.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  let current = view
  let widthPx = options.widthPx
  let hosts: RowIconHost[] = []
  let nowShown = false

  const timeline = new Timeline(container, [], {
    // Days arrive already resolved in the organization's zone; UTC keeps the axis from re-reading them in the browser's.
    moment: (input?: Parameters<MomentConstructor1>[0]) => moment(input).utc(),
    locale: options.locale,
    ...windowOptions(view.window, widthPx),
    stack: true,
    groupHeightMode: 'fitItems',
    // Zero horizontal margin: the default 10px would read two bars a day apart as an overlap and stack them.
    margin: { item: { horizontal: 0, vertical: 4 } },
    horizontalScroll: false,
    verticalScroll: true,
    zoomKey: 'ctrlKey',
    selectable: true,
    editable: false,
    orientation: { axis: 'top', item: 'top' },
    timeAxis: { scale: 'day', step: 1 },
    showCurrentTime: false,
    groupOrder: () => 0,
    format: {
      minorLabels: (date: Date) => {
        const day = new Date(date.valueOf())
        return `${weekday.format(day).replace('.', '').toUpperCase()}\n${day.getUTCDate()}`
      },
      majorLabels: (date: Date) => month.format(new Date(date.valueOf())),
    },
  })

  function draw(next: TimelineView): void {
    hosts = []
    timeline.setGroups(groupsOf(next, hosts))
    timeline.setItems(itemsOf(next))
    if (next.wallClock) {
      const now = new Date(`${next.wallClock}.000Z`)
      if (nowShown) timeline.setCustomTime(now, NOW_MARKER)
      else timeline.addCustomTime(now, NOW_MARKER)
      nowShown = true
    } else if (nowShown) {
      timeline.removeCustomTime(NOW_MARKER)
      nowShown = false
    }
  }

  draw(view)
  timeline.on('select', (properties: { items?: IdType[] }) => {
    const [first] = (properties.items ?? []).filter(isBar)
    options.onSelectionChange?.(first === undefined ? null : String(first))
  })

  return {
    update(next) {
      const windowChanged = next.window.from !== current.window.from || next.window.to !== current.window.to
      draw(next)
      if (windowChanged) {
        timeline.setOptions(windowOptions(next.window, widthPx))
        timeline.setWindow(toAxis(next.window.from), toAxis(next.window.to), { animation: false })
      }
      current = next
    },
    resize(nextWidth) {
      if (nextWidth === widthPx) return
      widthPx = nextWidth
      timeline.setOptions({ width: `${widthPx}px` })
    },
    select(barId) {
      timeline.setSelection(barId ? [barId] : [])
    },
    rowIconHosts() {
      return hosts
    },
    destroy() {
      timeline.destroy()
    },
  }
}
