import { UniqueConstraintViolationException } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { buildChanges } from '@open-mercato/shared/lib/commands/helpers'
import { ensureOrganizationScope, ensureTenantScope } from '@open-mercato/shared/lib/commands/scope'
import { extractUndoPayload } from '@open-mercato/shared/lib/commands/undo'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { QueryEngine } from '@open-mercato/shared/lib/query/types'
import type { ZodType } from 'zod'
import { BookingSubject, BookingSubjectCategory } from '../../data/entities'
import { bookingSubjectAddSchema, bookingSubjectUpdateSchema } from '../../data/validators'
import type { BookingSubjectAddInput, BookingSubjectUpdateInput } from '../../data/validators'
import { bookingsErrors } from '../../lib/errors'
import { requireBookingsSettings } from '../../services/settings/effective-settings'
import type { BookingsScope } from '../../services/settings/effective-settings'
import { getSubjectProvider } from '../../services/subjects/providers/registry'
import type { SubjectProvider } from '../../services/subjects/providers/provider'

export const BOOKING_SUBJECT_RESOURCE_KIND = 'bookings.subject'

type RbacService = {
  userHasAllFeatures: (
    userId: string,
    features: string[],
    scope: { tenantId: string | null; organizationId: string | null }
  ) => Promise<boolean>
}

type SubjectSnapshot = {
  id: string
  tenantId: string
  organizationId: string
  providerKey: string
  providerRecordId: string
  name: string
  categoryId: string | null
  timeZone: string
  isActive: boolean
  deletedAt: string | null
}

type UndoPayload = { before?: SubjectSnapshot | null; after?: SubjectSnapshot | null }

const EDITABLE_FIELDS = ['categoryId', 'timeZone', 'isActive'] as const

function parse<T>(schema: ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw ?? {})
  if (!parsed.success) throw bookingsErrors.invalidInput(parsed.error)
  return parsed.data
}

function entityManagerOf(ctx: CommandRuntimeContext): EntityManager {
  return (ctx.container.resolve('em') as EntityManager).fork()
}

function snapshotOf(subject: BookingSubject): SubjectSnapshot {
  return {
    id: subject.id,
    tenantId: subject.tenantId,
    organizationId: subject.organizationId,
    providerKey: subject.providerKey,
    providerRecordId: subject.providerRecordId,
    name: subject.name,
    categoryId: subject.category?.id ?? null,
    timeZone: subject.timeZone,
    isActive: subject.isActive,
    deletedAt: subject.deletedAt ? subject.deletedAt.toISOString() : null,
  }
}

async function findSubject(
  em: EntityManager,
  id: string,
  scope: { tenantId?: string | null; organizationId?: string | null },
  withDeleted = false
) {
  return findOneWithDecryption(
    em,
    BookingSubject,
    { id, ...(withDeleted ? {} : { deletedAt: null }) },
    undefined,
    scope
  )
}

function requireProvider(providerKey: string): SubjectProvider {
  const provider = getSubjectProvider(providerKey)
  if (!provider) throw bookingsErrors.unknownProvider(providerKey)
  return provider
}

async function categoryReference(em: EntityManager, scope: BookingsScope, categoryId: string | null | undefined) {
  if (!categoryId) return null
  const category = await em.findOne(BookingSubjectCategory, { ...scope, id: categoryId, deletedAt: null })
  if (!category) throw bookingsErrors.unknownCategories([categoryId])
  return category
}

async function assertMayCreateAt(ctx: CommandRuntimeContext, scope: BookingsScope, provider: SubjectProvider) {
  const rbac = ctx.container.resolve('rbacService') as RbacService
  const allowed = ctx.auth?.sub ? await rbac.userHasAllFeatures(ctx.auth.sub, [provider.createFeature], scope) : false
  if (!allowed) throw bookingsErrors.providerForbidden(provider.createFeature)
}

async function logLabel(key: string, fallback: string): Promise<string> {
  const { translate } = await resolveTranslations()
  return translate(key, fallback)
}

const addSubjectCommand: CommandHandler<BookingSubjectAddInput, { id: string }> = {
  id: 'bookings.subjects.add',
  async execute(rawInput, ctx) {
    const input = parse(bookingSubjectAddSchema, rawInput)
    ensureTenantScope(ctx, input.tenantId)
    ensureOrganizationScope(ctx, input.organizationId)
    const scope: BookingsScope = { tenantId: input.tenantId, organizationId: input.organizationId }
    const em = entityManagerOf(ctx)
    const settings = await requireBookingsSettings(em, scope)
    const provider = requireProvider(input.providerKey)
    const category = await categoryReference(em, scope, input.categoryId)

    let providerRecordId: string
    let name: string
    if (input.mode === 'existing') {
      const queryEngine = ctx.container.resolve('queryEngine') as QueryEngine
      const record = (await provider.describe({ queryEngine, scope }, [input.providerRecordId])).get(input.providerRecordId)
      if (!record) throw bookingsErrors.providerRecordNotFound(provider.key, input.providerRecordId)
      providerRecordId = record.recordId
      name = record.name
    } else {
      await assertMayCreateAt(ctx, scope, provider)
      providerRecordId = await provider.createRecord(ctx, scope, { name: input.name })
      name = input.name
    }

    const removed = await em.findOne(
      BookingSubject,
      { ...scope, providerKey: provider.key, providerRecordId, deletedAt: { $ne: null } },
      { orderBy: { updatedAt: 'desc' } }
    )
    const subject =
      removed ??
      em.create(BookingSubject, {
        ...scope,
        providerKey: provider.key,
        providerRecordId,
        name,
        category,
        timeZone: input.timeZone ?? settings.timeZone,
      })
    if (removed) {
      removed.deletedAt = null
      removed.isActive = true
      removed.name = name
      if (input.categoryId !== undefined) removed.category = category
      if (input.timeZone !== undefined) removed.timeZone = input.timeZone
      removed.updatedAt = new Date()
    } else {
      em.persist(subject)
    }
    try {
      await em.flush()
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        throw bookingsErrors.subjectAlreadyAdded(provider.key, providerRecordId)
      }
      if (input.mode === 'new') throw bookingsErrors.subjectNotAttached(provider.key, providerRecordId)
      throw error
    }
    return { id: subject.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const subject = await findSubject(entityManagerOf(ctx), result.id, {})
    return subject ? snapshotOf(subject) : null
  },
  buildLog: async ({ snapshots }) => {
    const after = snapshots.after as SubjectSnapshot | null | undefined
    if (!after) return null
    return {
      actionLabel: await logLabel('bookings.audit.subjects.add', 'Add subject'),
      resourceKind: BOOKING_SUBJECT_RESOURCE_KIND,
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
    const subject = await findSubject(em, after.id, after)
    if (!subject) return
    subject.deletedAt = new Date()
    subject.updatedAt = new Date()
    await em.flush()
  },
}

const updateSubjectCommand: CommandHandler<BookingSubjectUpdateInput, { id: string }> = {
  id: 'bookings.subjects.update',
  async prepare(rawInput, ctx) {
    const input = parse(bookingSubjectUpdateSchema, rawInput)
    const subject = await findSubject(entityManagerOf(ctx), input.id, input)
    return subject ? { before: snapshotOf(subject) } : {}
  },
  async execute(rawInput, ctx) {
    const input = parse(bookingSubjectUpdateSchema, rawInput)
    const em = entityManagerOf(ctx)
    const subject = await findSubject(em, input.id, {
      tenantId: ctx.auth?.tenantId ?? null,
      organizationId: ctx.selectedOrganizationId ?? null,
    })
    if (!subject) throw bookingsErrors.notFound('bookings.subjects.errors.notFound')
    ensureTenantScope(ctx, subject.tenantId)
    ensureOrganizationScope(ctx, subject.organizationId)
    const scope: BookingsScope = { tenantId: subject.tenantId, organizationId: subject.organizationId }

    if (input.categoryId !== undefined) subject.category = await categoryReference(em, scope, input.categoryId)
    if (input.timeZone !== undefined) subject.timeZone = input.timeZone
    if (input.isActive !== undefined) subject.isActive = input.isActive
    subject.updatedAt = new Date()
    await em.flush()
    return { id: subject.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const subject = await findSubject(entityManagerOf(ctx), result.id, {})
    return subject ? snapshotOf(subject) : null
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as SubjectSnapshot | undefined
    const after = snapshots.after as SubjectSnapshot | undefined
    if (!before || !after) return null
    return {
      actionLabel: await logLabel('bookings.audit.subjects.update', 'Update subject'),
      resourceKind: BOOKING_SUBJECT_RESOURCE_KIND,
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      changes: buildChanges(before, after, EDITABLE_FIELDS),
      payload: { undo: { before, after } satisfies UndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const before = extractUndoPayload<UndoPayload>(logEntry)?.before
    if (!before) return
    const em = entityManagerOf(ctx)
    const subject = await findSubject(em, before.id, before, true)
    if (!subject) return
    subject.category = before.categoryId ? em.getReference(BookingSubjectCategory, before.categoryId) : null
    subject.timeZone = before.timeZone
    subject.isActive = before.isActive
    subject.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(addSubjectCommand)
registerCommand(updateSubjectCommand)

export { addSubjectCommand, updateSubjectCommand }
