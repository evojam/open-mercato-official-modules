import type {
  ReservationDetailDto,
  ReservationListDto,
  SettingsDto,
  SubjectRowDto,
  TargetDto,
  TimelineRowDto,
} from './validators'

export const CREATED_RESERVATION_ID = '00000000-0000-4000-8000-0000000000ff'
export const CREATED_TARGET_ID = '00000000-0000-4000-8000-0000000000fe'

export const subjectFixtures: SubjectRowDto[] = [
  {
    subjectType: 'resource',
    subjectId: '00000000-0000-4000-8000-000000000001',
    label: 'Excavator XC-01',
    category: { id: 'cat-machines', label: 'Machines' },
    isActive: true,
  },
  {
    subjectType: 'resource',
    subjectId: '00000000-0000-4000-8000-000000000002',
    label: 'Crane KR-07',
    category: { id: 'cat-machines', label: 'Machines' },
    isActive: true,
  },
  {
    subjectType: 'ruleset',
    subjectId: '00000000-0000-4000-8000-000000000003',
    label: 'Meeting Room A',
    category: { id: 'cat-rooms', label: 'Rooms' },
    isActive: true,
  },
]

export const targetFixtures: TargetDto[] = [
  {
    id: '00000000-0000-4000-8000-000000000011',
    name: 'Riverside construction site',
    window: { startsAt: '2026-08-03', endsAt: '2026-09-30' },
    addressText: 'Nadbrzeżna 12, Kraków',
    updatedAt: '2026-08-01T08:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000012',
    name: 'Warehouse retrofit',
    window: null,
    addressText: null,
    updatedAt: '2026-08-01T08:00:00.000Z',
  },
]

export const reservationListFixtures: ReservationListDto[] = [
  {
    id: '00000000-0000-4000-8000-000000000021',
    subjectType: 'resource',
    subjectId: '00000000-0000-4000-8000-000000000001',
    subjectLabel: 'Excavator XC-01',
    targetId: '00000000-0000-4000-8000-000000000011',
    targetName: 'Riverside construction site',
    durationWorkingDays: 5,
    latestStart: '2026-08-10',
    status: 'active',
    placement: { startAt: '2026-08-03T00:00:00.000Z', endAt: '2026-08-08T00:00:00.000Z' },
    note: null,
    updatedAt: '2026-08-01T08:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000022',
    subjectType: 'resource',
    subjectId: '00000000-0000-4000-8000-000000000001',
    subjectLabel: 'Excavator XC-01',
    targetId: '00000000-0000-4000-8000-000000000012',
    targetName: 'Warehouse retrofit',
    durationWorkingDays: 3,
    latestStart: null,
    status: 'planned',
    placement: { startAt: '2026-08-06T00:00:00.000Z', endAt: '2026-08-11T00:00:00.000Z' },
    note: 'Overlaps the riverside job — expected conflict fixture',
    updatedAt: '2026-08-01T08:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000023',
    subjectType: 'ruleset',
    subjectId: '00000000-0000-4000-8000-000000000003',
    subjectLabel: 'Meeting Room A',
    targetId: null,
    targetName: 'Quarterly review (ad hoc)',
    durationWorkingDays: 1,
    latestStart: '2026-08-21',
    status: 'planned',
    placement: null,
    note: 'Backlog fixture — free-form target',
    updatedAt: '2026-08-01T08:00:00.000Z',
  },
]

export const reservationDetailFixture: ReservationDetailDto = {
  ...reservationListFixtures[0],
  subjectProviderKey: 'resources',
  createdAt: '2026-07-20T08:00:00.000Z',
}

export const unplacedFixtures: ReservationListDto[] = [reservationListFixtures[2]]

export const timelineRowFixtures: TimelineRowDto[] = [
  {
    subject: subjectFixtures[0],
    reservations: [
      { ...reservationListFixtures[0], conflict: true },
      { ...reservationListFixtures[1], conflict: true },
    ],
    unavailability: [],
  },
  {
    subject: subjectFixtures[1],
    reservations: [],
    unavailability: [
      {
        startAt: '2026-08-04T00:00:00.000Z',
        endAt: '2026-08-06T00:00:00.000Z',
        reasonLabel: 'Scheduled service',
      },
    ],
  },
  {
    subject: subjectFixtures[2],
    reservations: [],
    unavailability: [],
  },
]

export const settingsFixture: SettingsDto = {
  offWeekdays: [0, 6],
  holidays: ['2026-08-15', '2026-12-25'],
  coverageWarningDays: 3,
  timezone: 'Europe/Warsaw',
}
