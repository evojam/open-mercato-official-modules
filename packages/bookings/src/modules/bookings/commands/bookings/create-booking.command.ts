import { randomUUID } from 'node:crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import { ensureOrganizationScope, ensureTenantScope } from '@open-mercato/shared/lib/commands/scope'
import { extractUndoPayload } from '@open-mercato/shared/lib/commands/undo'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { resolveConflictPolicy } from '../../../../lib/pure-engine'
import type { Conflict } from '../../../../lib/pure-engine'
import { Booking, BookingParticipant, BookingSubject, BookingTarget } from '../../data/entities'
import type { BookingStatus } from '../../data/entities'
import { bookingCreateSchema } from '../../data/validators'
import type { BookingCreateInput } from '../../data/validators'
import { emitBookingsEvent } from '../../events'
import { bookingsErrors } from '../../lib/errors'
import { findConflicts } from '../../services/bookings/conflict-check.service'
import { placeBooking } from '../../services/bookings/placement.service'
import type { BookingPlacement } from '../../services/bookings/placement.service'
import { lockSubjects } from '../../services/bookings/subject-lock'
import { resolveEffectiveBookingsSettings } from '../../services/settings/effective-settings'
import type { BookingsScope } from '../../services/settings/effective-settings'

export const BOOKING_RESOURCE_KIND = 'bookings.booking'

export type BookingWarning = 'start_on_free_day'

export type BookingCreateResult = {
  id: string
  conflicts: Conflict[]
  warnings: BookingWarning[]
}

type BookingSnapshot = {
  id: string
  tenantId: string
  organizationId: string
  targetId: string
  subjectIds: string[]
  status: BookingStatus
  startAt: string | null
  endAt: string | null
  durationValue: string
  expectedStartOn: string
  note: string | null
}

type UndoPayload = { after?: BookingSnapshot | null }

function parse(raw: unknown): BookingCreateInput {
  const parsed = bookingCreateSchema.safeParse(raw ?? {})
  if (!parsed.success) throw bookingsErrors.invalidInput(parsed.error)
  return parsed.data
}

function entityManagerOf(ctx: CommandRuntimeContext): EntityManager {
  return (ctx.container.resolve('em') as EntityManager).fork()
}

async function loadSnapshot(em: EntityManager, id: string): Promise<BookingSnapshot | null> {
  const booking = await em.findOne(Booking, { id, deletedAt: null }, { populate: ['target'] })
  if (!booking) return null
  const participants = await em.find(BookingParticipant, { booking: id, deletedAt: null }, { fields: ['subject'] })
  return {
    id: booking.id,
    tenantId: booking.tenantId,
    organizationId: booking.organizationId,
    targetId: booking.target.id,
    subjectIds: participants.map((participant) => participant.subject.id),
    status: booking.status,
    startAt: booking.startAt ? booking.startAt.toISOString() : null,
    endAt: booking.endAt ? booking.endAt.toISOString() : null,
    durationValue: booking.durationValue,
    expectedStartOn: booking.expectedStartOn,
    note: booking.note ?? null,
  }
}

async function loadParticipants(em: EntityManager, scope: BookingsScope, subjectIds: string[]) {
  const subjects = await em.find(
    BookingSubject,
    { ...scope, id: { $in: subjectIds }, deletedAt: null },
    { populate: ['category'] }
  )
  if (subjects.length !== subjectIds.length) throw bookingsErrors.notFound('bookings.bookings.errors.subjectNotFound')
  const inactive = subjects.filter((subject) => !subject.isActive).map((subject) => subject.id)
  if (inactive.length > 0) throw bookingsErrors.subjectInactive(inactive)
  return subjects
}

const createBookingCommand: CommandHandler<BookingCreateInput, BookingCreateResult> = {
  id: 'bookings.bookings.create',
  async execute(rawInput, ctx) {
    const input = parse(rawInput)
    ensureTenantScope(ctx, input.tenantId)
    ensureOrganizationScope(ctx, input.organizationId)
    const scope: BookingsScope = { tenantId: input.tenantId, organizationId: input.organizationId }
    const em = entityManagerOf(ctx)
    const settings = await resolveEffectiveBookingsSettings(em, scope)
    if (!settings.timeZone) throw bookingsErrors.settingsRequired()

    const target = await em.findOne(BookingTarget, { ...scope, id: input.targetId, deletedAt: null })
    if (!target) throw bookingsErrors.notFound('bookings.targets.errors.notFound')
    const subjects = await loadParticipants(em, scope, input.subjectIds)
    const policy = resolveConflictPolicy(
      settings.conflictPolicy,
      settings.conflictPolicyExceptions,
      subjects.map((subject) => subject.category?.id ?? null)
    )
    const placement: BookingPlacement | null = input.startOn
      ? placeBooking({
          startOn: input.startOn,
          durationWorkingDays: input.durationValue,
          calendar: settings.calendar,
          targetZone: target.timeZone,
        })
      : null

    const bookingId = randomUUID()
    let conflicts: Conflict[] = []
    await withAtomicFlush(
      em,
      [
        async () => {
          if (!placement) return
          await lockSubjects(em, input.subjectIds)
          conflicts = await findConflicts(em, scope, {
            bookingId,
            targetName: target.name,
            subjectIds: input.subjectIds,
            days: placement.days,
          })
          if (policy === 'reject' && conflicts.some((conflict) => conflict.kind === 'overlap')) {
            throw bookingsErrors.bookingConflict(conflicts)
          }
        },
        () => {
          const booking = em.create(Booking, {
            ...scope,
            id: bookingId,
            target,
            startAt: placement?.startAt ?? null,
            endAt: placement?.endAt ?? null,
            status: 'planned',
            durationValue: String(input.durationValue),
            durationUnit: 'working_days',
            expectedStartOn: input.expectedStartOn,
            note: input.note ?? null,
          })
          em.persist(booking)
          for (const subject of subjects) {
            em.persist(em.create(BookingParticipant, { ...scope, booking, subject, role: 'performer' }))
          }
        },
      ],
      { transaction: true }
    )

    await emitBookingsEvent(
      'bookings.booking.created',
      { id: bookingId, ...scope, subjectIds: input.subjectIds, conflicts: conflicts.length },
      { persistent: true }
    )
    return {
      id: bookingId,
      conflicts,
      warnings: placement?.startsOnFreeDay ? ['start_on_free_day'] : [],
    }
  },
  captureAfter: async (_input, result, ctx) => loadSnapshot(entityManagerOf(ctx), result.id),
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as BookingSnapshot | null | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('bookings.audit.bookings.create', 'Create booking'),
      resourceKind: BOOKING_RESOURCE_KIND,
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } satisfies UndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const after = extractUndoPayload<UndoPayload>(logEntry)?.after
    if (!after) return
    const em = entityManagerOf(ctx)
    const booking = await em.findOne(Booking, { id: after.id, tenantId: after.tenantId, organizationId: after.organizationId, deletedAt: null })
    if (!booking) return
    const now = new Date()
    booking.deletedAt = now
    booking.updatedAt = now
    const participants = await em.find(BookingParticipant, { booking: booking.id, deletedAt: null })
    for (const participant of participants) {
      participant.deletedAt = now
      participant.updatedAt = now
    }
    await em.flush()
    await emitBookingsEvent('bookings.booking.deleted', { id: booking.id, tenantId: after.tenantId, organizationId: after.organizationId }, { persistent: true })
  },
}

registerCommand(createBookingCommand)

export { createBookingCommand }
