import { randomUUID } from 'node:crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { ensureOrganizationScope, ensureTenantScope } from '@open-mercato/shared/lib/commands/scope'
import { extractUndoPayload } from '@open-mercato/shared/lib/commands/undo'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { Booking, BookingParticipant } from '../../data/entities'
import { bookingCreateSchema } from '../../data/validators'
import type { BookingCreateInput } from '../../data/validators'
import { emitBookingsEvent } from '../../events'
import { bookingsErrors } from '../../lib/errors'
import { loadSnapshot, loadSubjects, loadTarget, policyFor, requireZonedSettings } from '../../services/bookings/booking-loader'
import type { BookingSnapshot } from '../../services/bookings/booking-loader'
import { placeBooking } from '../../services/bookings/placement.service'
import { writeBooking } from '../../services/bookings/reschedule.service'
import type { BookingsScope } from '../../services/settings/effective-settings'
import { BOOKING_RESOURCE_KIND } from '../shared/booking-write.commands'
import type { BookingWriteResult } from '../shared/booking-write.commands'

export type { BookingWarning } from '../shared/booking-write.commands'

export type BookingCreateResult = BookingWriteResult

type UndoPayload = { after?: BookingSnapshot | null }

function parse(raw: unknown): BookingCreateInput {
  const parsed = bookingCreateSchema.safeParse(raw ?? {})
  if (!parsed.success) throw bookingsErrors.invalidInput(parsed.error)
  return parsed.data
}

function entityManagerOf(ctx: CommandRuntimeContext): EntityManager {
  return (ctx.container.resolve('em') as EntityManager).fork()
}

function scopeOf(input: BookingsScope): BookingsScope {
  return { tenantId: input.tenantId, organizationId: input.organizationId }
}

const createBookingCommand: CommandHandler<BookingCreateInput, BookingCreateResult> = {
  id: 'bookings.bookings.create',
  async execute(rawInput, ctx) {
    const input = parse(rawInput)
    ensureTenantScope(ctx, input.tenantId)
    ensureOrganizationScope(ctx, input.organizationId)
    const scope = scopeOf(input)
    const em = entityManagerOf(ctx)
    const settings = await requireZonedSettings(em, scope)
    const target = await loadTarget(em, scope, input.targetId)
    const subjects = await loadSubjects(em, scope, input.subjectIds)
    const placement = input.startOn
      ? placeBooking({
          startOn: input.startOn,
          durationWorkingDays: input.durationValue,
          calendar: settings.calendar,
          targetZone: target.timeZone,
        })
      : null

    const bookingId = randomUUID()
    const conflicts = await writeBooking(em, scope, {
      targetId: target.id,
      window: placement
        ? {
            bookingId,
            targetName: target.name,
            subjectIds: input.subjectIds,
            days: placement.days,
            status: 'planned',
            policy: policyFor(settings, subjects),
          }
        : null,
      apply: () => {
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
    })

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
  captureAfter: async (rawInput, result, ctx) => loadSnapshot(entityManagerOf(ctx), scopeOf(parse(rawInput)), result.id),
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
    const scope = scopeOf(after)
    const booking = await em.findOne(Booking, { ...scope, id: after.id, deletedAt: null })
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
    await emitBookingsEvent('bookings.booking.deleted', { id: booking.id, ...scope }, { persistent: true })
  },
}

registerCommand(createBookingCommand)

export { createBookingCommand }
