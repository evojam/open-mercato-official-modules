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
  unknownCategories: (categoryIds: string[]) =>
    new CrudHttpError(400, {
      error: 'bookings.settings.errors.exceptionCategory',
      code: 'unknown_category',
      details: { categoryIds },
    }),
  unknownProvider: (providerKey: string) =>
    new CrudHttpError(400, { error: 'bookings.subjects.errors.unknownProvider', code: 'unknown_provider', details: { providerKey } }),
  providerForbidden: (feature: string) =>
    new CrudHttpError(403, { error: 'bookings.subjects.errors.providerForbidden', code: 'provider_forbidden', details: { feature } }),
  providerRecordNotFound: (providerKey: string, providerRecordId: string) =>
    new CrudHttpError(404, {
      error: 'bookings.subjects.errors.recordNotFound',
      code: 'provider_record_not_found',
      details: { providerKey, providerRecordId },
    }),
  subjectAlreadyAdded: (providerKey: string, providerRecordId: string) =>
    new CrudHttpError(409, {
      error: 'bookings.subjects.errors.alreadyAdded',
      code: 'subject_already_added',
      details: { providerKey, providerRecordId },
    }),
  subjectNotAttached: (providerKey: string, providerRecordId: string) =>
    new CrudHttpError(409, {
      error: 'bookings.subjects.errors.notAttached',
      code: 'provider_record_orphaned',
      details: { providerKey, providerRecordId },
    }),
  settingsConflict: () => new CrudHttpError(409, { error: 'bookings.settings.errors.conflict', code: 'settings_conflict' }),
  targetInUse: (openBookings: number) =>
    new CrudHttpError(409, { error: 'bookings.targets.errors.inUse', code: 'target_in_use', details: { openBookings } }),
  bookingConflict: (conflicts: unknown[]) =>
    new CrudHttpError(409, { error: 'bookings.bookings.errors.conflict', code: 'booking_conflict', details: { conflicts } }),
  subjectInactive: (subjectIds: string[]) =>
    new CrudHttpError(400, { error: 'bookings.bookings.errors.subjectInactive', code: 'subject_inactive', details: { subjectIds } }),
  categoryInUse: (subjects: number, exceptions: number) =>
    new CrudHttpError(409, {
      error: 'bookings.categories.errors.inUse',
      code: 'category_in_use',
      details: { subjects, exceptions },
    }),
}
