import { UniqueConstraintViolationException } from '@mikro-orm/core'
import type { EntityClass } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { buildChanges } from '@open-mercato/shared/lib/commands/helpers'
import { ensureOrganizationScope, ensureTenantScope } from '@open-mercato/shared/lib/commands/scope'
import { extractUndoPayload } from '@open-mercato/shared/lib/commands/undo'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { ZodType } from 'zod'
import { bookingsErrors } from '../../lib/errors'
import type { BookingsScope } from '../../services/settings/effective-settings'

type DecryptionScope = { tenantId?: string | null; organizationId?: string | null }

type ScopedRecord = {
  id: string
  organizationId: string
  tenantId: string
  updatedAt: Date
  deletedAt?: Date | null
}

type Snapshot = Record<string, unknown> & {
  id: string
  organizationId: string
  tenantId: string
  deletedAt: string | null
}

type UndoPayload = { before?: Snapshot | null; after?: Snapshot | null }

type Label = readonly [key: string, fallback: string]

export type ScopedRecordDefinition<TEntity extends ScopedRecord, TCreate extends BookingsScope> = {
  commandPrefix: string
  resourceKind: string
  entity: EntityClass<TEntity>
  fields: readonly (keyof TEntity & string)[]
  createSchema: ZodType<TCreate>
  updateSchema: ZodType<BookingsScope & { id: string } & Partial<Record<keyof TEntity & string, unknown>>>
  labels: { create: Label; update: Label; delete: Label }
  errors: { notFound: string; duplicate: { error: string; code: string } }
  valuesForCreate: (em: EntityManager, input: TCreate) => Promise<Partial<TEntity>>
  beforeDelete?: (em: EntityManager, record: TEntity) => Promise<void>
}

function parse<T>(schema: ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw ?? {})
  if (!parsed.success) throw bookingsErrors.invalidInput(parsed.error)
  return parsed.data
}

function entityManagerOf(ctx: CommandRuntimeContext): EntityManager {
  return (ctx.container.resolve('em') as EntityManager).fork()
}

async function flushOrConflict(em: EntityManager, duplicate: { error: string; code: string }): Promise<void> {
  try {
    await em.flush()
  } catch (error) {
    if (error instanceof UniqueConstraintViolationException) throw bookingsErrors.duplicate(duplicate.error, duplicate.code)
    throw error
  }
}

export function registerScopedRecordCommands<TEntity extends ScopedRecord, TCreate extends BookingsScope>(
  definition: ScopedRecordDefinition<TEntity, TCreate>
) {
  const { entity, fields, resourceKind } = definition

  const snapshotOf = (record: TEntity): Snapshot => {
    const values: Record<string, unknown> = {}
    for (const field of fields) values[field] = record[field] ?? null
    return {
      ...values,
      id: record.id,
      organizationId: record.organizationId,
      tenantId: record.tenantId,
      deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
    }
  }

  const find = async (em: EntityManager, id: string, scope: DecryptionScope, withDeleted = false) =>
    findOneWithDecryption(
      em,
      entity,
      { id, ...(withDeleted ? {} : { deletedAt: null }) } as never,
      undefined,
      scope
    ) as Promise<TEntity | null>

  const findInScope = async (em: EntityManager, ctx: CommandRuntimeContext, id: string): Promise<TEntity> => {
    const record = await find(em, id, { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.selectedOrganizationId ?? null })
    if (!record) throw bookingsErrors.notFound(definition.errors.notFound)
    ensureTenantScope(ctx, record.tenantId)
    ensureOrganizationScope(ctx, record.organizationId)
    return record
  }

  const logBase = async (label: Label, snapshot: Snapshot) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate(label[0], label[1]),
      resourceKind,
      resourceId: snapshot.id,
      tenantId: snapshot.tenantId,
      organizationId: snapshot.organizationId,
    }
  }

  const create: CommandHandler<TCreate, { id: string }> = {
    id: `${definition.commandPrefix}.create`,
    async execute(rawInput, ctx) {
      const input = parse(definition.createSchema, rawInput)
      ensureTenantScope(ctx, input.tenantId)
      ensureOrganizationScope(ctx, input.organizationId)
      const em = entityManagerOf(ctx)
      const values = await definition.valuesForCreate(em, input)
      const record = em.create(entity, {
        ...values,
        tenantId: input.tenantId,
        organizationId: input.organizationId,
      } as never)
      em.persist(record)
      await flushOrConflict(em, definition.errors.duplicate)
      return { id: record.id }
    },
    captureAfter: async (_input, result, ctx) => {
      const record = await find(entityManagerOf(ctx), result.id, {})
      return record ? snapshotOf(record) : null
    },
    buildLog: async ({ snapshots }) => {
      const after = snapshots.after as Snapshot | null | undefined
      if (!after) return null
      return {
        ...(await logBase(definition.labels.create, after)),
        snapshotAfter: after,
        payload: { undo: { after } satisfies UndoPayload },
      }
    },
    undo: async ({ logEntry, ctx }) => {
      const after = extractUndoPayload<UndoPayload>(logEntry)?.after
      if (!after) return
      const em = entityManagerOf(ctx)
      const record = await find(em, after.id, after)
      if (!record) return
      await definition.beforeDelete?.(em, record)
      record.deletedAt = new Date()
      record.updatedAt = new Date()
      await em.flush()
    },
  }

  const update: CommandHandler<BookingsScope & { id: string }, { id: string }> = {
    id: `${definition.commandPrefix}.update`,
    async prepare(rawInput, ctx) {
      const input = parse(definition.updateSchema, rawInput)
      const record = await find(entityManagerOf(ctx), input.id, input)
      return record ? { before: snapshotOf(record) } : {}
    },
    async execute(rawInput, ctx) {
      const input = parse(definition.updateSchema, rawInput) as Record<string, unknown> & { id: string }
      const em = entityManagerOf(ctx)
      const record = await findInScope(em, ctx, input.id)
      for (const field of fields) {
        if (input[field] !== undefined) Object.assign(record, { [field]: input[field] })
      }
      record.updatedAt = new Date()
      await flushOrConflict(em, definition.errors.duplicate)
      return { id: record.id }
    },
    captureAfter: async (_input, result, ctx) => {
      const record = await find(entityManagerOf(ctx), result.id, {})
      return record ? snapshotOf(record) : null
    },
    buildLog: async ({ snapshots }) => {
      const before = snapshots.before as Snapshot | undefined
      const after = snapshots.after as Snapshot | undefined
      if (!before || !after) return null
      return {
        ...(await logBase(definition.labels.update, before)),
        snapshotBefore: before,
        snapshotAfter: after,
        changes: buildChanges(before, after, fields),
        payload: { undo: { before, after } satisfies UndoPayload },
      }
    },
    undo: async ({ logEntry, ctx }) => {
      const before = extractUndoPayload<UndoPayload>(logEntry)?.before
      if (!before) return
      const em = entityManagerOf(ctx)
      const record = await find(em, before.id, before, true)
      if (!record) return
      for (const field of fields) Object.assign(record, { [field]: before[field] })
      record.updatedAt = new Date()
      await flushOrConflict(em, definition.errors.duplicate)
    },
  }

  const remove: CommandHandler<{ id?: string }, { id: string }> = {
    id: `${definition.commandPrefix}.delete`,
    async prepare(input, ctx) {
      if (!input?.id) return {}
      const record = await find(entityManagerOf(ctx), input.id, {
        tenantId: ctx.auth?.tenantId ?? null,
        organizationId: ctx.selectedOrganizationId ?? null,
      })
      return record ? { before: snapshotOf(record) } : {}
    },
    async execute(input, ctx) {
      if (!input?.id) throw bookingsErrors.idRequired()
      const em = entityManagerOf(ctx)
      const record = await findInScope(em, ctx, input.id)
      await definition.beforeDelete?.(em, record)
      record.deletedAt = new Date()
      record.updatedAt = new Date()
      await em.flush()
      return { id: record.id }
    },
    buildLog: async ({ snapshots }) => {
      const before = snapshots.before as Snapshot | undefined
      if (!before) return null
      return {
        ...(await logBase(definition.labels.delete, before)),
        snapshotBefore: before,
        payload: { undo: { before } satisfies UndoPayload },
      }
    },
    undo: async ({ logEntry, ctx }) => {
      const before = extractUndoPayload<UndoPayload>(logEntry)?.before
      if (!before) return
      const em = entityManagerOf(ctx)
      const record = await find(em, before.id, before, true)
      if (!record) return
      record.deletedAt = null
      record.updatedAt = new Date()
      await flushOrConflict(em, definition.errors.duplicate)
    },
  }

  registerCommand(create)
  registerCommand(update)
  registerCommand(remove)
  return { create, update, delete: remove }
}
