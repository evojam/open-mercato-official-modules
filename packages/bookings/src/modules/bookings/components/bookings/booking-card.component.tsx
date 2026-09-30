'use client'

import * as React from 'react'
import { Clock, Flag, Pencil, TriangleAlert, Trash2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { SimpleTooltip } from '@open-mercato/ui/primitives/tooltip'
import type { BookingCardBadgeTone, BookingCardViewModel } from '../../../../lib/booking-card'
import { categoryIcon } from '../subjects/category-icons'

const BADGE_CLASS: Record<BookingCardBadgeTone, string> = {
  warning: 'bg-status-warning-icon/15 text-status-warning-text',
  danger: 'bg-destructive/12 text-destructive',
}

export type BookingCardProps = {
  readonly vm: BookingCardViewModel
  readonly editLabel?: string
  readonly deleteLabel?: string
  readonly onClick?: () => void
  readonly onEdit?: () => void
  readonly onDelete?: () => void
  readonly noteExpandable?: boolean
  readonly children?: React.ReactNode
  readonly className?: string
}

function stop(event: React.SyntheticEvent): void {
  event.stopPropagation()
}

export function BookingCard({
  vm,
  editLabel,
  deleteLabel,
  onClick,
  onEdit,
  onDelete,
  noteExpandable = true,
  children,
  className,
}: BookingCardProps) {
  const t = useT()
  const [noteExpanded, setNoteExpanded] = React.useState(false)
  const SubjectIcon = categoryIcon(vm.iconName)
  const interactive = Boolean(onClick)

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={[
        'flex w-full flex-col gap-1.75 rounded-lg border bg-card px-3 py-2.5 shadow-xs transition-colors',
        vm.tone === 'danger' ? 'border-destructive hover:border-destructive' : '',
        interactive ? 'cursor-pointer select-none hover:bg-accent hover:shadow-sm' : '',
        interactive && vm.tone !== 'danger' ? 'hover:border-foreground' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={[
            'inline-flex size-6.5 shrink-0 items-center justify-center rounded-sm',
            vm.accentColor ? '' : 'bg-muted text-muted-foreground',
          ]
            .filter(Boolean)
            .join(' ')}
          style={
            vm.accentColor
              ? {
                  background: `color-mix(in oklab, ${vm.accentColor} 14%, transparent)`,
                  color: vm.accentColor,
                }
              : undefined
          }
        >
          <SubjectIcon className="size-3.5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="truncate text-sm font-semibold">{vm.title}</span>
          {vm.subtitle ? <span className="truncate font-mono text-xs text-muted-foreground">{vm.subtitle}</span> : null}
        </span>
        {onEdit || onDelete ? (
          <span className="inline-flex shrink-0 items-center gap-0.5">
            {onEdit ? (
              <button
                type="button"
                aria-label={editLabel}
                title={editLabel}
                onClick={(event) => {
                  stop(event)
                  onEdit()
                }}
                className="inline-flex size-6.5 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                aria-label={deleteLabel}
                title={deleteLabel}
                onClick={(event) => {
                  stop(event)
                  onDelete()
                }}
                className="inline-flex size-6.5 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/12 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            ) : null}
          </span>
        ) : null}
      </div>

      {vm.problemLabel ? (
        <span className="text-xs font-medium leading-snug text-muted-foreground">{vm.problemLabel}</span>
      ) : null}

      {vm.relation ? (
        <div className="flex min-w-0 items-center gap-1.5">
          {vm.relation.color ? (
            <span className="size-2 shrink-0 rounded-[2px]" style={{ background: vm.relation.color }} />
          ) : null}
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">{vm.relation.label}</span>
          {vm.priorityLabel ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full bg-status-warning-bg px-1.5 py-px text-xs font-semibold text-status-warning-text">
              <Flag className="size-2.5" /> {vm.priorityLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      {vm.term ? (
        <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3.25 shrink-0" />
          <span className="min-w-0 truncate font-mono text-xs text-foreground">{vm.term}</span>
        </div>
      ) : null}

      {vm.badge ? (
        <span
          className={`inline-flex w-fit max-w-full items-center gap-2 rounded-full px-2 py-0.5 text-xs font-semibold leading-snug ${BADGE_CLASS[vm.badge.tone]}`}
        >
          <TriangleAlert className="size-2.75 shrink-0" />
          <span className="min-w-0">{vm.badge.label}</span>
        </span>
      ) : null}

      {vm.note && !noteExpandable ? (
        <SimpleTooltip content={vm.note} size="lg" align="start">
          <button type="button" onClick={stop} className="line-clamp-2 text-left text-xs leading-snug text-muted-foreground">
            {vm.note}
          </button>
        </SimpleTooltip>
      ) : null}

      {vm.note && noteExpandable ? (
        <button
          type="button"
          aria-expanded={noteExpanded}
          title={
            noteExpanded
              ? t('bookings.card.collapseNote', 'Collapse the note')
              : t('bookings.card.expandNote', 'Expand the note')
          }
          onClick={(event) => {
            stop(event)
            setNoteExpanded((was) => !was)
          }}
          className={`text-left text-xs leading-snug text-muted-foreground ${noteExpanded ? '' : 'line-clamp-2'}`}
        >
          {vm.note}
        </button>
      ) : null}

      {vm.rows.length > 0 || children ? (
        <div className="mt-auto flex flex-col gap-2.5 pt-0.5">
          {vm.rows.map((row, index) =>
            row.layout === 'stacked' ? (
              <div key={`${row.label}-${index}`} className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {row.label}
                  {row.hint ? (
                    <span className="rounded-sm bg-muted px-1 font-mono text-xs font-semibold text-foreground">{row.hint}</span>
                  ) : null}
                </span>
                <span className="font-mono text-xs tabular-nums">{row.value}</span>
              </div>
            ) : (
              <div key={`${row.label}-${index}`} className="flex items-center justify-between gap-2.5">
                <span className="whitespace-nowrap text-xs text-muted-foreground">{row.label}</span>
                <span className="shrink-0 text-right text-sm">{row.value}</span>
              </div>
            )
          )}
          {children}
        </div>
      ) : null}
    </div>
  )
}
