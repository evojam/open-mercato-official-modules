import { z } from 'zod'
import { reservationStatusSchema, subjectTypeSchema } from './dto.schema'

export const durationWorkingDaysSchema = z
  .number()
  .positive()
  .multipleOf(0.5)

export const createReservationSchema = z.object({
  subjectType: subjectTypeSchema,
  subjectId: z.uuid(),
  subjectProviderKey: z.string().min(1),
  targetId: z.uuid().optional(),
  targetText: z.string().min(1).optional(),
  durationWorkingDays: durationWorkingDaysSchema,
  latestStart: z.iso.date().optional(),
  note: z.string().optional(),
  startAt: z.iso.datetime().optional(),
})
export type CreateReservationInput = z.output<typeof createReservationSchema>

export const updateReservationSchema = z.object({
  targetId: z.uuid().optional(),
  targetText: z.string().min(1).optional(),
  latestStart: z.iso.date().nullable().optional(),
  note: z.string().nullable().optional(),
})
export type UpdateReservationInput = z.output<typeof updateReservationSchema>

export const placeReservationSchema = z.object({
  startAt: z.iso.datetime(),
})
export type PlaceReservationInput = z.output<typeof placeReservationSchema>

export const moveReservationSchema = z.object({
  startAt: z.iso.datetime(),
})
export type MoveReservationInput = z.output<typeof moveReservationSchema>

export const resizeReservationSchema = z.object({
  durationWorkingDays: durationWorkingDaysSchema,
})
export type ResizeReservationInput = z.output<typeof resizeReservationSchema>

export const changeReservationStatusSchema = z.object({
  status: reservationStatusSchema,
})
export type ChangeReservationStatusInput = z.output<typeof changeReservationStatusSchema>

const pageSchema = z.coerce.number().int().min(1).default(1)
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(50)

export const reservationListQuerySchema = z.object({
  subjectType: subjectTypeSchema.optional(),
  subjectId: z.uuid().optional(),
  targetId: z.uuid().optional(),
  status: reservationStatusSchema.optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
})
export type ReservationListQuery = z.output<typeof reservationListQuerySchema>

export const unplacedListQuerySchema = z.object({
  provider: z.string().min(1).optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
})
export type UnplacedListQuery = z.output<typeof unplacedListQuerySchema>

export const timelineQuerySchema = z
  .object({
    provider: z.string().min(1),
    from: z.iso.date(),
    to: z.iso.date(),
    categoryId: z.string().min(1).optional(),
    page: pageSchema,
    pageSize: pageSizeSchema,
  })
  .refine((q) => q.to >= q.from, { error: 'to must not precede from', path: ['to'] })
export type TimelineQuery = z.output<typeof timelineQuerySchema>

export const subjectsQuerySchema = z.object({
  provider: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
})
export type SubjectsQuery = z.output<typeof subjectsQuerySchema>
