import type { EntityManager } from '@mikro-orm/postgresql'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { buildChanges } from '@open-mercato/shared/lib/commands/helpers'
import { ensureOrganizationScope, ensureTenantScope } from '@open-mercato/shared/lib/commands/scope'
import { extractUndoPayload } from '@open-mercato/shared/lib/commands/undo'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { ZodType } from 'zod'
import { isOpen } from '../../../../lib/pure-engine'
import type { BookingStatus, Conflict } from '../../../../lib/pure-engine'
import { bookingDays } from '../../../../lib/time/day-ranges'
import type { DayRange, IsoDate } from '../../../../lib/time/types'
import type { BookingSubject, BookingTarget } from '../../data/entities'
import { emitBookingsEvent } from '../../events'
import type { BookingsEventId } from '../../events'
import { bookingsErrors } from '../../lib/errors'
import { loadBookingForWrite, loadSnapshot, loadSubjects, loadTarget, policyFor } from '../../services/bookings/booking-loader'
import type { BookingSnapshot, LoadedBooking } from '../../services/bookings/booking-loader'
import { placeBooking } from '../../services/bookings/placement.service'
import type { BookingPlacement } from '../../services/bookings/placement.service'
import { syncParticipants, writeBooking } from '../../services/bookings/reschedule.service'
import type { BookingWrite, OccupiedWindow } from '../../services/bookings/reschedule.service'
import type { BookingsScope } from '../../services/settings/effective-settings'

export const BOOKING_RESOURCE_KIND = 'bookings.booking'

export type BookingWarning = 'start_on_free_day'

export type BookingWriteResult = {
  id: string
  conflicts: Conflict[]
  warnings: BookingWarning[]
}

export type BookingWriteInput = BookingsScope & { id: string }

export type BookingWritePlan = {
  event: BookingsEventId
  write: BookingWrite
  warnings?: BookingWarning[]
}

export type BookingWriteDefinition<TInput extends BookingWriteInput> = {
  commandId: string
  schema: ZodType<TInput>
  label: readonly [key: string, fallback: string]
  plan: (em: EntityManager, scope: BookingsScope, loaded: LoadedBooking, input: TInput) => Promise<BookingWritePlan>
}

type UndoPayload = { before?: BookingSnapshot | null; after?: BookingSnapshot | null }

const CHANGE_FIELDS = [
  'targetId',
  'subjectIds',
  'status',
  'startAt',
  'endAt',
  'durationValue',
  'expectedStartOn',
  'lastWarnedWorkingDays',
  'note',
] as const

function entityManagerOf(ctx: CommandRuntimeContext): EntityManager {
  return (ctx.container.resolve('em') as EntityManager).fork()
}

function scopeOf(input: BookingsScope): BookingsScope {
  return { tenantId: input.tenantId, organizationId: input.organizationId }
}

function comparable(snapshot: BookingSnapshot): Record<string, unknown> {
  return { ...snapshot, subjectIds: snapshot.subjectIds.join(',') }
}

export function windowFor(
  loaded: LoadedBooking,
  days: DayRange,
  overrides: { subjects?: readonly BookingSubject[]; target?: BookingTarget; status?: BookingStatus } = {}
): OccupiedWindow {
  const subjects = overrides.subjects ?? loaded.participants.map((participant) => participant.subject)
  const target = overrides.target ?? loaded.booking.target
  return {
    bookingId: loaded.booking.id,
    targetName: target.name,
    subjectIds: subjects.map((subject) => subject.id),
    days,
    status: overrides.status ?? loaded.booking.status,
    policy: policyFor(loaded.settings, subjects),
  }
}

export function placementFor(
  loaded: LoadedBooking,
  input: { startOn: IsoDate; durationWorkingDays?: number; target?: BookingTarget }
): BookingPlacement {
  return placeBooking({
    startOn: input.startOn,
    durationWorkingDays: input.durationWorkingDays ?? Number(loaded.booking.durationValue),
    calendar: loaded.settings.calendar,
    targetZone: (input.target ?? loaded.booking.target).timeZone,
  })
}

async function restoreBooking(
  em: EntityManager,
  scope: BookingsScope,
  loaded: LoadedBooking,
  before: BookingSnapshot
): Promise<void> {
  const { booking } = loaded
  const target = before.targetId === booking.target.id ? booking.target : await loadTarget(em, scope, before.targetId)
  const subjects = await loadSubjects(em, scope, before.subjectIds)
  const startAt = before.startAt ? new Date(before.startAt) : null
  const endAt = before.endAt ? new Date(before.endAt) : null
  const days = startAt && endAt ? bookingDays({ from: startAt, to: endAt }, target.timeZone) : null
  await writeBooking(em, scope, {
    targetId: target.id,
    window: days && isOpen(before.status) ? windowFor(loaded, days, { subjects, target, status: before.status }) : null,
    apply: () => {
      booking.target = target
      booking.status = before.status
      booking.startAt = startAt
      booking.endAt = endAt
      booking.durationValue = before.durationValue
      booking.durationUnit = before.durationUnit
      booking.expectedStartOn = before.expectedStartOn
      booking.lastWarnedWorkingDays = before.lastWarnedWorkingDays
      booking.note = before.note
      booking.updatedAt = new Date()
      syncParticipants(em, scope, booking, loaded.participants, subjects)
    },
  })
}

export function registerBookingWriteCommand<TInput extends BookingWriteInput>(
  definition: BookingWriteDefinition<TInput>
): CommandHandler<TInput, BookingWriteResult> {
  const parse = (raw: unknown): TInput => {
    const parsed = definition.schema.safeParse(raw ?? {})
    if (!parsed.success) throw bookingsErrors.invalidInput(parsed.error)
    return parsed.data
  }

  const handler: CommandHandler<TInput, BookingWriteResult> = {
    id: definition.commandId,
    async prepare(rawInput, ctx) {
      const input = parse(rawInput)
      const before = await loadSnapshot(entityManagerOf(ctx), scopeOf(input), input.id)
      return before ? { before } : {}
    },
    async execute(rawInput, ctx) {
      const input = parse(rawInput)
      ensureTenantScope(ctx, input.tenantId)
      ensureOrganizationScope(ctx, input.organizationId)
      const scope = scopeOf(input)
      const em = entityManagerOf(ctx)
      const loaded = await loadBookingForWrite(em, scope, input.id)
      const plan = await definition.plan(em, scope, loaded, input)
      const conflicts = await writeBooking(em, scope, plan.write)
      await emitBookingsEvent(
        plan.event,
        { id: input.id, ...scope, status: loaded.booking.status, conflicts: conflicts.length },
        { persistent: true }
      )
      return { id: input.id, conflicts, warnings: plan.warnings ?? [] }
    },
    captureAfter: async (rawInput, result, ctx) => loadSnapshot(entityManagerOf(ctx), scopeOf(parse(rawInput)), result.id),
    buildLog: async ({ snapshots }) => {
      const before = snapshots.before as BookingSnapshot | null | undefined
      const after = snapshots.after as BookingSnapshot | null | undefined
      if (!before || !after) return null
      const { translate } = await resolveTranslations()
      return {
        actionLabel: translate(definition.label[0], definition.label[1]),
        resourceKind: BOOKING_RESOURCE_KIND,
        resourceId: after.id,
        tenantId: after.tenantId,
        organizationId: after.organizationId,
        snapshotBefore: before,
        snapshotAfter: after,
        changes: buildChanges(comparable(before), comparable(after), CHANGE_FIELDS),
        payload: { undo: { before, after } satisfies UndoPayload },
      }
    },
    undo: async ({ logEntry, ctx }) => {
      const before = extractUndoPayload<UndoPayload>(logEntry)?.before
      if (!before) return
      const em = entityManagerOf(ctx)
      const scope = scopeOf(before)
      const loaded = await loadBookingForWrite(em, scope, before.id)
      await restoreBooking(em, scope, loaded, before)
      await emitBookingsEvent(
        'bookings.booking.updated',
        { id: before.id, ...scope, status: before.status, conflicts: 0 },
        { persistent: true }
      )
    },
  }

  registerCommand(handler)
  return handler
}
