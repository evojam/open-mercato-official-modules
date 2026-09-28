'use client'

import * as React from 'react'
import Link from 'next/link'
import { CalendarOff } from 'lucide-react'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Alert, AlertDescription } from '@open-mercato/ui/primitives/alert'
import { Button } from '@open-mercato/ui/primitives/button'
import { EmptyState } from '@open-mercato/ui/primitives/empty-state'
import { Timeline } from '../../../../lib/timeline/ui/timeline.component'
import type { TimelineRow } from '../../../../lib/timeline/types'
import { CreateBookingDialog } from '../bookings/create-booking-dialog.component'
import { categoryIcon } from '../subjects/category-icons'
import { TimelineHeader } from './timeline-header.component'
import { TimelineLegend } from './timeline-legend.component'
import { presentTimeline } from './timeline.presenter'
import { useTimeline } from './use-timeline.hook'

const SETTINGS_HREF = '/backend/config/bookings'
const SUBJECTS_HREF = '/backend/bookings/subjects'

function renderRowIcon(row: TimelineRow): React.ReactNode {
  const Icon = categoryIcon(row.iconName)
  return <Icon aria-hidden />
}

export function TimelineBoard() {
  const t = useT()
  const locale = useLocale()
  const timeline = useTimeline()
  const [creating, setCreating] = React.useState(false)
  const [drawFailed, setDrawFailed] = React.useState(false)
  const [drawAttempt, setDrawAttempt] = React.useState(0)
  const { view, error, loading, filters } = timeline
  const formatDate = React.useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' })
    return (date: string) => formatter.format(new Date(`${date}T00:00:00Z`))
  }, [locale])
  const timelineView = React.useMemo(
    () => (view ? presentTimeline(view, { t, formatDate }) : null),
    [view, t, formatDate]
  )

  if (error?.code === 'settings_required') {
    return (
      <Alert status="warning" className="m-5">
        <AlertDescription className="flex flex-wrap items-center gap-3">
          {t(error.message, error.message)}
          <Button asChild size="sm" variant="outline">
            <Link href={SETTINGS_HREF}>{t('bookings.timeline.actions.openSettings', 'Open settings')}</Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const filtered = filters.categoryId !== null || filters.conflictsOnly || filters.hideUnavailable
  const rowCount = timelineView?.rows.length ?? 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TimelineHeader
        labels={{
          title: t('bookings.timeline.title', 'Timeline'),
          range: t('bookings.timeline.filters.range', 'Date range'),
          resetRange: t('bookings.timeline.actions.resetRange', 'Back to this week'),
          rowCount: t('bookings.timeline.rowCount', '{count} subjects', { count: rowCount }),
          category: t('bookings.timeline.filters.category', 'Category'),
          allCategories: t('bookings.timeline.filters.allCategories', 'All categories'),
          conflictsOnly: t('bookings.timeline.filters.conflictsOnly', 'Only conflicts'),
          hideUnavailable: t('bookings.timeline.filters.hideUnavailable', 'Hide unavailable'),
          newBooking: t('bookings.timeline.actions.newBooking', 'New booking'),
        }}
        range={view?.range ?? null}
        isDefaultRange={timeline.isDefaultRange}
        onRangeChange={timeline.setRange}
        categories={timeline.categories}
        filters={filters}
        onFiltersChange={timeline.updateFilters}
        canCreate={view?.canCreate ?? false}
        onCreate={() => setCreating(true)}
      />
      {view ? (
        <CreateBookingDialog
          open={creating}
          today={view.today}
          onOpenChange={setCreating}
          onCreated={() => void timeline.reload()}
        />
      ) : null}
      <TimelineLegend
        labels={{
          conflict: t('bookings.timeline.legend.conflict', 'Conflict'),
          unavailable: t('bookings.timeline.legend.unavailable', 'Unavailable'),
          free: t('bookings.timeline.legend.free', 'Free'),
          done: t('bookings.timeline.legend.done', 'Done'),
          now: t('bookings.timeline.legend.now', 'Now'),
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {error ? (
          <Alert status="error" className="mx-5 mt-2">
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {t(error.message, error.message)}
              <Button size="sm" variant="outline" onClick={() => void timeline.reload()}>
                {t('bookings.timeline.actions.retry', 'Retry')}
              </Button>
            </AlertDescription>
          </Alert>
        ) : !timelineView && loading ? (
          <LoadingMessage className="mx-5" label={t('bookings.timeline.messages.loading', 'Loading the timeline…')} />
        ) : timelineView && timelineView.rows.length === 0 ? (
          <EmptyState
            icon={<CalendarOff className="size-5" aria-hidden="true" />}
            title={
              filtered
                ? t('bookings.timeline.empty.filteredTitle', 'No subjects match these filters')
                : t('bookings.timeline.empty.title', 'No subjects yet')
            }
            description={
              filtered ? undefined : t('bookings.timeline.empty.description', 'Add subjects to see them on the timeline.')
            }
            actions={
              filtered ? undefined : (
                <Button asChild variant="outline">
                  <Link href={SUBJECTS_HREF}>{t('bookings.timeline.actions.openSubjects', 'Open subjects')}</Link>
                </Button>
              )
            }
          />
        ) : timelineView && drawFailed ? (
          <Alert status="error" className="mx-5 mt-2">
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {t('bookings.timeline.errors.drawFailed', 'Failed to load the timeline view.')}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDrawFailed(false)
                  setDrawAttempt((attempt) => attempt + 1)
                }}
              >
                {t('bookings.timeline.actions.retry', 'Retry')}
              </Button>
            </AlertDescription>
          </Alert>
        ) : timelineView ? (
          <Timeline
            key={drawAttempt}
            view={timelineView}
            locale={locale}
            selectedId={timeline.selectedId}
            onSelectionChange={timeline.setSelectedId}
            onLoadError={() => setDrawFailed(true)}
            renderRowIcon={renderRowIcon}
          />
        ) : null}
      </div>
    </div>
  )
}
