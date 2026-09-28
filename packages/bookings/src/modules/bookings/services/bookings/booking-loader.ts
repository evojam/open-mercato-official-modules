import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveConflictPolicy } from '../../../../lib/pure-engine'
import type { BookingConflictPolicy, BookingStatus } from '../../../../lib/pure-engine'
import { bookingDays } from '../../../../lib/time/day-ranges'
import type { DayRange } from '../../../../lib/time/types'
import { Booking, BookingParticipant, BookingSubject, BookingTarget } from '../../data/entities'
import type { BookingDurationUnit } from '../../data/entities'
import { bookingsErrors } from '../../lib/errors'
import { resolveEffectiveBookingsSettings } from '../settings/effective-settings'
import type { BookingsScope, EffectiveBookingsSettings } from '../settings/effective-settings'

export type BookingSnapshot = {
  id: string
  tenantId: string
  organizationId: string
  targetId: string
  subjectIds: string[]
  status: BookingStatus
  startAt: string | null
  endAt: string | null
  durationValue: string
  durationUnit: BookingDurationUnit
  expectedStartOn: string
  lastWarnedWorkingDays: number | null
  note: string | null
}

export type ZonedBookingsSettings = EffectiveBookingsSettings & { timeZone: string }

export type LoadedBooking = {
  booking: Booking
  participants: BookingParticipant[]
  settings: ZonedBookingsSettings
}

export async function requireZonedSettings(em: EntityManager, scope: BookingsScope): Promise<ZonedBookingsSettings> {
  const settings = await resolveEffectiveBookingsSettings(em, scope)
  if (!settings.timeZone) throw bookingsErrors.settingsRequired()
  return { ...settings, timeZone: settings.timeZone }
}

export async function loadTarget(em: EntityManager, scope: BookingsScope, targetId: string): Promise<BookingTarget> {
  const target = await em.findOne(BookingTarget, { ...scope, id: targetId, deletedAt: null })
  if (!target) throw bookingsErrors.notFound('bookings.targets.errors.notFound')
  return target
}

export async function loadSubjects(
  em: EntityManager,
  scope: BookingsScope,
  subjectIds: readonly string[]
): Promise<BookingSubject[]> {
  const subjects = await em.find(
    BookingSubject,
    { ...scope, id: { $in: [...subjectIds] }, deletedAt: null },
    { populate: ['category'] }
  )
  if (subjects.length !== subjectIds.length) throw bookingsErrors.notFound('bookings.bookings.errors.subjectNotFound')
  const inactive = subjects.filter((subject) => !subject.isActive).map((subject) => subject.id)
  if (inactive.length > 0) throw bookingsErrors.subjectInactive(inactive)
  return subjects
}

export async function loadBookingForWrite(em: EntityManager, scope: BookingsScope, id: string): Promise<LoadedBooking> {
  const settings = await requireZonedSettings(em, scope)
  const booking = await em.findOne(Booking, { ...scope, id, deletedAt: null }, { populate: ['target'] })
  if (!booking) throw bookingsErrors.notFound('bookings.bookings.errors.notFound')
  const participants = await em.find(
    BookingParticipant,
    { booking: booking.id, deletedAt: null },
    { populate: ['subject', 'subject.category'] }
  )
  return { booking, participants, settings }
}

export function policyFor(settings: EffectiveBookingsSettings, subjects: readonly BookingSubject[]): BookingConflictPolicy {
  return resolveConflictPolicy(
    settings.conflictPolicy,
    settings.conflictPolicyExceptions,
    subjects.map((subject) => subject.category?.id ?? null)
  )
}

export function currentDays(booking: Booking): DayRange | null {
  if (!booking.startAt || !booking.endAt) return null
  return bookingDays({ from: booking.startAt, to: booking.endAt }, booking.target.timeZone)
}

export async function loadSnapshot(em: EntityManager, scope: BookingsScope, id: string): Promise<BookingSnapshot | null> {
  const booking = await em.findOne(Booking, { ...scope, id, deletedAt: null }, { populate: ['target'] })
  if (!booking) return null
  const participants = await em.find(BookingParticipant, { booking: id, deletedAt: null }, { fields: ['subject'] })
  return {
    id: booking.id,
    tenantId: booking.tenantId,
    organizationId: booking.organizationId,
    targetId: booking.target.id,
    subjectIds: participants.map((participant) => participant.subject.id).sort(),
    status: booking.status,
    startAt: booking.startAt ? booking.startAt.toISOString() : null,
    endAt: booking.endAt ? booking.endAt.toISOString() : null,
    durationValue: booking.durationValue,
    durationUnit: booking.durationUnit,
    expectedStartOn: booking.expectedStartOn,
    lastWarnedWorkingDays: booking.lastWarnedWorkingDays ?? null,
    note: booking.note ?? null,
  }
}
