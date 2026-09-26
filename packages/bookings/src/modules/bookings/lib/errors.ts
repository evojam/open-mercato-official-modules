import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { ZodError } from 'zod'
import { validationDetails } from './validation-details'

export const bookingsErrors = {
  unauthorized: () => new CrudHttpError(401, { error: 'bookings.errors.unauthorized', code: 'unauthorized' }),
  organizationRequired: () =>
    new CrudHttpError(400, { error: 'bookings.errors.organizationRequired', code: 'organization_required' }),
  invalidInput: (error: ZodError, key = 'bookings.errors.invalidInput') =>
    new CrudHttpError(400, { error: key, code: 'invalid_input', details: validationDetails(error) }),
  idRequired: () => new CrudHttpError(400, { error: 'bookings.errors.idRequired', code: 'id_required' }),
  notFound: (key: string) => new CrudHttpError(404, { error: key, code: 'not_found' }),
  duplicate: (key: string, code: string) => new CrudHttpError(409, { error: key, code }),
  settingsRequired: () =>
    new CrudHttpError(409, { error: 'bookings.settings.errors.settingsRequired', code: 'settings_required' }),
  timeZoneRequired: () =>
    new CrudHttpError(400, { error: 'bookings.settings.errors.timeZoneRequired', code: 'time_zone_required' }),
  settingsConflict: () => new CrudHttpError(409, { error: 'bookings.settings.errors.conflict', code: 'settings_conflict' }),
  targetInUse: (openBookings: number) =>
    new CrudHttpError(409, { error: 'bookings.targets.errors.inUse', code: 'target_in_use', details: { openBookings } }),
  categoryInUse: (subjects: number, exceptions: number) =>
    new CrudHttpError(409, {
      error: 'bookings.categories.errors.inUse',
      code: 'category_in_use',
      details: { subjects, exceptions },
    }),
}
