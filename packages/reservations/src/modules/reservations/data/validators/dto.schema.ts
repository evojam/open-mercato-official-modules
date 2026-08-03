import { z } from 'zod'

export const errorSchema = z.object({
  code: z.string(),
  details: z.unknown().optional(),
})

export const subjectTypeSchema = z.enum(['resource', 'ruleset'])
export type SubjectType = z.infer<typeof subjectTypeSchema>

export const reservationStatusSchema = z.enum(['planned', 'active', 'done', 'cancelled'])
export type ReservationStatus = z.infer<typeof reservationStatusSchema>

export const subjectCategorySchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string().optional(),
  icon: z.string().optional(),
})

export const subjectRowDtoSchema = z.object({
  subjectType: subjectTypeSchema,
  subjectId: z.uuid(),
  label: z.string(),
  category: subjectCategorySchema,
  isActive: z.boolean(),
})
export type SubjectRowDto = z.infer<typeof subjectRowDtoSchema>

export const placementSchema = z.object({
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
})

export const reservationListDtoSchema = z.object({
  id: z.uuid(),
  subjectType: subjectTypeSchema,
  subjectId: z.uuid(),
  subjectLabel: z.string(),
  targetId: z.uuid().nullable(),
  targetName: z.string(),
  durationWorkingDays: z.number(),
  latestStart: z.iso.date().nullable(),
  status: reservationStatusSchema,
  placement: placementSchema.nullable(),
  note: z.string().nullable(),
  updatedAt: z.iso.datetime(),
})
export type ReservationListDto = z.infer<typeof reservationListDtoSchema>

export const reservationDetailDtoSchema = reservationListDtoSchema.extend({
  subjectProviderKey: z.string(),
  createdAt: z.iso.datetime(),
})
export type ReservationDetailDto = z.infer<typeof reservationDetailDtoSchema>

export const reservationTimelineItemDtoSchema = reservationListDtoSchema.extend({
  conflict: z.boolean(),
})
export type ReservationTimelineItemDto = z.infer<typeof reservationTimelineItemDtoSchema>

export const unavailabilityWindowDtoSchema = z.object({
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  reasonLabel: z.string().optional(),
})
export type UnavailabilityWindowDto = z.infer<typeof unavailabilityWindowDtoSchema>

export const timelineRowDtoSchema = z.object({
  subject: subjectRowDtoSchema,
  reservations: z.array(reservationTimelineItemDtoSchema),
  unavailability: z.array(unavailabilityWindowDtoSchema),
})
export type TimelineRowDto = z.infer<typeof timelineRowDtoSchema>

export const targetWindowSchema = z.object({
  startsAt: z.iso.date(),
  endsAt: z.iso.date(),
})

export const targetDtoSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  window: targetWindowSchema.nullable(),
  addressText: z.string().nullable(),
  updatedAt: z.iso.datetime(),
})
export type TargetDto = z.infer<typeof targetDtoSchema>

export const settingsDtoSchema = z.object({
  offWeekdays: z.array(z.number().int().min(0).max(6)),
  holidays: z.array(z.iso.date()),
  coverageWarningDays: z.number().int().min(0),
  timezone: z.string(),
})
export type SettingsDto = z.infer<typeof settingsDtoSchema>

export const busyWindowDtoSchema = z.object({
  reservationId: z.uuid(),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  status: z.enum(['planned', 'active']),
})
export type BusyWindowDto = z.infer<typeof busyWindowDtoSchema>
