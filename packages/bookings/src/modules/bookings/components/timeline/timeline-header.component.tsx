'use client'

import * as React from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import { CheckboxField } from '@open-mercato/ui/primitives/checkbox-field'
import { DateRangePicker } from '@open-mercato/ui/primitives/date-range-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@open-mercato/ui/primitives/select'
import { lastDayOf, rangeThrough } from '../../../../lib/timeline/layout/range'
import type { DayRange, IsoDate } from '../../../../lib/time/types'
import type { TimelineCategoryOption, TimelineFilters } from './use-timeline.hook'

const ALL_CATEGORIES = 'all'

export type TimelineHeaderLabels = {
  title: string
  range: string
  resetRange: string
  rowCount: string
  category: string
  allCategories: string
  conflictsOnly: string
  hideUnavailable: string
  newBooking: string
  editBooking: string
}

export type TimelineHeaderProps = {
  labels: TimelineHeaderLabels
  range: DayRange | null
  isDefaultRange: boolean
  onRangeChange: (range: DayRange | null) => void
  categories: TimelineCategoryOption[]
  filters: TimelineFilters
  onFiltersChange: (patch: Partial<TimelineFilters>) => void
  canCreate: boolean
  onCreate: () => void
  canEdit: boolean
  onEdit: () => void
}

// The picker speaks local Date objects; only their calendar fields are read, never an instant.
function toPickerDate(date: IsoDate): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function fromPickerDate(date: Date): IsoDate {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

export function TimelineHeader({
  labels,
  range,
  isDefaultRange,
  onRangeChange,
  categories,
  filters,
  onFiltersChange,
  canCreate,
  onCreate,
  canEdit,
  onEdit,
}: TimelineHeaderProps) {
  return (
    <div className="shrink-0">
      <div className="flex items-center gap-4 px-5 pb-3 pt-4">
        <h1 className="min-w-0 flex-1 truncate text-2xl font-bold tracking-tight">{labels.title}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <DateRangePicker
            value={range ? { start: toPickerDate(range.from), end: toPickerDate(lastDayOf(range)) } : null}
            onChange={(next) => {
              if (next) onRangeChange(rangeThrough(fromPickerDate(next.start), fromPickerDate(next.end)))
            }}
            aria-label={labels.range}
            className="w-auto"
          />
          {!isDefaultRange ? (
            <Button variant="ghost" size="sm" onClick={() => onRangeChange(null)}>
              {labels.resetRange}
            </Button>
          ) : null}
        </div>
        <div className="min-w-0 flex-1" />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3.5">
        <Select
          value={filters.categoryId ?? ALL_CATEGORIES}
          onValueChange={(next) => onFiltersChange({ categoryId: next === ALL_CATEGORIES ? null : next })}
        >
          <SelectTrigger aria-label={labels.category} className="h-9 w-auto min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>{labels.allCategories}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <CheckboxField
          label={labels.conflictsOnly}
          checked={filters.conflictsOnly}
          onCheckedChange={(checked) => onFiltersChange({ conflictsOnly: checked === true })}
        />
        <CheckboxField
          label={labels.hideUnavailable}
          checked={filters.hideUnavailable}
          onCheckedChange={(checked) => onFiltersChange({ hideUnavailable: checked === true })}
        />

        <div className="ml-auto flex items-center gap-2.5">
          <span className="whitespace-nowrap text-xs text-muted-foreground">{labels.rowCount}</span>
          {canEdit ? (
            <Button variant="outline" onClick={onEdit}>
              <Pencil className="size-4" /> {labels.editBooking}
            </Button>
          ) : null}
          {canCreate ? (
            <Button onClick={onCreate}>
              <Plus className="size-4" /> {labels.newBooking}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
