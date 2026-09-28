'use client'

import * as React from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { Conflict } from '../../../../lib/pure-engine'
import type { DayRange } from '../../../../lib/time/types'
import { BOOKINGS_API_PATHS } from '../../lib/api-paths'

export type ConflictPreviewInput = {
  subjectIds: readonly string[]
  window: DayRange | null
  excludeBookingId?: string | null
  enabled: boolean
}

export type ConflictPreview = {
  conflicts: Conflict[]
  busySubjectIds: ReadonlySet<string>
  loading: boolean
}

const DEBOUNCE_MS = 300

const NO_SUBJECTS: ReadonlySet<string> = new Set()

export function useConflictPreview(input: ConflictPreviewInput): ConflictPreview {
  const [conflicts, setConflicts] = React.useState<Conflict[]>([])
  const [loading, setLoading] = React.useState(false)
  const latestRequest = React.useRef(0)
  const subjectKey = [...input.subjectIds].sort().join(',')
  const from = input.window?.from ?? null
  const to = input.window?.to ?? null
  const exclude = input.excludeBookingId ?? null

  React.useEffect(() => {
    const request = ++latestRequest.current
    if (!input.enabled || !subjectKey || !from || !to) {
      setConflicts([])
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ subjectIds: subjectKey, from, to })
      if (exclude) params.set('excludeBookingId', exclude)
      void apiCall<{ conflicts: Conflict[] }>(`${BOOKINGS_API_PATHS.conflicts}?${params.toString()}`)
        .then((call) => {
          if (request === latestRequest.current) setConflicts(call.ok ? (call.result?.conflicts ?? []) : [])
        })
        .catch(() => {
          if (request === latestRequest.current) setConflicts([])
        })
        .finally(() => {
          if (request === latestRequest.current) setLoading(false)
        })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [input.enabled, subjectKey, from, to, exclude])

  const busySubjectIds = React.useMemo<ReadonlySet<string>>(
    () => (conflicts.length ? new Set(conflicts.map((conflict) => conflict.subjectId)) : NO_SUBJECTS),
    [conflicts]
  )

  return { conflicts, busySubjectIds, loading }
}
