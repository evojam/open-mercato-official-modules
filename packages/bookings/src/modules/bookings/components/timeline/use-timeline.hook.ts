'use client'

import * as React from 'react'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useAppEvent } from '@open-mercato/ui/backend/injection/useAppEvent'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { DayRange } from '../../../../lib/time/types'
import { BOOKINGS_API_PATHS } from '../../lib/api-paths'
import type { TimelineResponseDto } from '../../services/timeline/timeline-read.service'

export type TimelineFilters = {
  categoryId: string | null
  conflictsOnly: boolean
  hideUnavailable: boolean
}

export type TimelineLoadError = {
  code: string | null
  message: string
}

export type TimelineCategoryOption = {
  id: string
  name: string
}

type ErrorBody = {
  error?: string
  code?: string
  details?: Array<{ message?: string }>
}

const LOAD_FAILED = 'bookings.timeline.errors.loadFailed'

const EMPTY_FILTERS: TimelineFilters = { categoryId: null, conflictsOnly: false, hideUnavailable: false }

function urlOf(range: DayRange | null, filters: TimelineFilters): string {
  const params = new URLSearchParams()
  if (range) {
    params.set('from', range.from)
    params.set('to', range.to)
  }
  if (filters.categoryId) params.set('categoryId', filters.categoryId)
  if (filters.conflictsOnly) params.set('conflictsOnly', 'true')
  if (filters.hideUnavailable) params.set('hideUnavailable', 'true')
  const query = params.toString()
  return query ? `${BOOKINGS_API_PATHS.timeline}?${query}` : BOOKINGS_API_PATHS.timeline
}

export function useTimeline() {
  const scopeVersion = useOrganizationScopeVersion()
  const [filters, setFilters] = React.useState<TimelineFilters>(EMPTY_FILTERS)
  const [customRange, setCustomRange] = React.useState<DayRange | null>(null)
  const [view, setView] = React.useState<TimelineResponseDto | null>(null)
  const [error, setError] = React.useState<TimelineLoadError | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [categories, setCategories] = React.useState<TimelineCategoryOption[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const latestRequest = React.useRef(0)

  React.useEffect(() => {
    void apiCall<{ items: TimelineCategoryOption[] }>(BOOKINGS_API_PATHS.subjectCategories)
      .then((call) => {
        if (call.ok) setCategories((call.result?.items ?? []).map(({ id, name }) => ({ id, name })))
      })
      .catch(() => setCategories([]))
  }, [scopeVersion])

  const reload = React.useCallback(async () => {
    const request = ++latestRequest.current
    setLoading(true)
    try {
      const call = await apiCall<TimelineResponseDto | ErrorBody>(urlOf(customRange, filters))
      if (request !== latestRequest.current) return
      if (call.ok && call.result) {
        setView(call.result as TimelineResponseDto)
        setError(null)
        return
      }
      const body = call.result as ErrorBody | null
      const detail = body?.code === 'invalid_input' ? body.details?.[0]?.message : undefined
      setError({ code: body?.code ?? null, message: detail ?? body?.error ?? LOAD_FAILED })
    } catch {
      if (request === latestRequest.current) setError({ code: null, message: LOAD_FAILED })
    } finally {
      if (request === latestRequest.current) setLoading(false)
    }
  }, [customRange, filters])

  React.useEffect(() => {
    void reload()
  }, [reload, scopeVersion])

  useAppEvent('bookings.booking.*', () => {
    void reload()
  })

  const updateFilters = React.useCallback((patch: Partial<TimelineFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
  }, [])

  return {
    view,
    error,
    loading,
    categories,
    filters,
    updateFilters,
    isDefaultRange: customRange === null,
    setRange: setCustomRange,
    selectedId,
    setSelectedId,
    reload,
  }
}
