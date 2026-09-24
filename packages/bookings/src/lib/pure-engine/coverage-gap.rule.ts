import type { IsoDate } from '../time/types'
import { isOpen } from './status.rule'
import type { BookingStatus } from './status.rule'
import { countWorkingDays } from './working-days.rule'
import type { WorkingCalendar } from './working-days.rule'

export type CoverageGapInput = {
  status: BookingStatus
  isPlaced: boolean
  expectedStartOn: IsoDate
  today: IsoDate
  calendar: WorkingCalendar
  thresholdWorkingDays: number
}

export type CoverageGap = {
  workingDaysLeft: number
  isOverdue: boolean
}

export function coverageGap(input: CoverageGapInput): CoverageGap | null {
  if (!Number.isInteger(input.thresholdWorkingDays) || input.thresholdWorkingDays < 0) {
    throw new RangeError(`Expected a non-negative whole threshold, received ${input.thresholdWorkingDays}`)
  }
  if (input.isPlaced || !isOpen(input.status)) return null

  if (input.expectedStartOn < input.today) return { workingDaysLeft: 0, isOverdue: true }

  const workingDaysLeft = countWorkingDays(input.today, input.expectedStartOn, input.calendar)
  return workingDaysLeft <= input.thresholdWorkingDays ? { workingDaysLeft, isOverdue: false } : null
}
