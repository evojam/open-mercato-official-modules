export const BOOKINGS_API_PATHS = {
  bookings: '/api/bookings/bookings',
  bookingActions: {
    place: '/api/bookings/bookings/actions/place',
    move: '/api/bookings/bookings/actions/move',
    resize: '/api/bookings/bookings/actions/resize',
    status: '/api/bookings/bookings/actions/status',
  },
  conflicts: '/api/bookings/conflicts',
  settings: '/api/bookings/settings',
  targets: '/api/bookings/targets',
  subjectCategories: '/api/bookings/subject-categories',
  subjects: '/api/bookings/subjects',
  subjectProviders: '/api/bookings/subjects/providers',
  subjectCandidates: '/api/bookings/subjects/candidates',
  timeline: '/api/bookings/timeline',
} as const

export const PLANNER_API_PATHS = {
  availability: '/api/planner/availability',
} as const
