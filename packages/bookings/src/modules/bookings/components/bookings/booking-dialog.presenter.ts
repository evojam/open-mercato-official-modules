import { addWorkingDays } from '../../../../lib/pure-engine'
import type { WorkingCalendar } from '../../../../lib/pure-engine'
import { isIsoDate } from '../../../../lib/time/day-ranges'
import type { DayRange, IsoDate } from '../../../../lib/time/types'

export type BookingFormValues = {
  targetId: string
  subjectId: string
  startOn: string
  durationValue: string
  expectedStartOn: string
  note: string
}

export type BookingFormOrigin = BookingFormValues & {
  placed: boolean
  participantCount: number
}

export type BookingUpdateBody = {
  targetId?: string
  subjectIds?: string[]
  expectedStartOn?: string
  note?: string | null
}

export type BookingSaveStep =
  | { kind: 'update'; body: BookingUpdateBody }
  | { kind: 'place' | 'move'; body: { startOn: IsoDate } }
  | { kind: 'resize'; body: { durationValue: number } }

const FIELDS: readonly (keyof BookingFormValues)[] = ['targetId', 'subjectId', 'startOn', 'durationValue', 'expectedStartOn', 'note']

export function isDirty(origin: BookingFormValues, values: BookingFormValues): boolean {
  return FIELDS.some((field) => origin[field].trim() !== values[field].trim())
}

export function planBookingSave(origin: BookingFormOrigin, values: BookingFormValues): BookingSaveStep[] {
  const steps: BookingSaveStep[] = []
  const update: BookingUpdateBody = {}
  if (values.targetId !== origin.targetId) update.targetId = values.targetId
  if (origin.participantCount <= 1 && values.subjectId !== origin.subjectId) update.subjectIds = [values.subjectId]
  if (values.expectedStartOn !== origin.expectedStartOn) update.expectedStartOn = values.expectedStartOn
  if (values.note.trim() !== origin.note.trim()) update.note = values.note.trim() || null
  if (Object.keys(update).length > 0) steps.push({ kind: 'update', body: update })
  if (values.startOn && values.startOn !== origin.startOn) {
    steps.push({ kind: origin.placed ? 'move' : 'place', body: { startOn: values.startOn } })
  }
  if (Number(values.durationValue) !== Number(origin.durationValue)) {
    steps.push({ kind: 'resize', body: { durationValue: Number(values.durationValue) } })
  }
  return steps
}

export function windowOf(startOn: string, durationValue: string, calendar: WorkingCalendar): DayRange | null {
  const duration = Number(durationValue)
  if (!isIsoDate(startOn) || !Number.isFinite(duration) || duration <= 0) return null
  return { from: startOn, to: addWorkingDays(startOn, duration, calendar) }
}
