import { createCrudFormError, mapCrudServerErrorToFormErrors } from '@open-mercato/ui/backend/utils/serverErrors'

type Translate = (key: string, fallback?: string) => string

export function translatedCrudError(error: unknown, t: Translate, fallbackKey: string): Error {
  const { message, fieldErrors } = mapCrudServerErrorToFormErrors(error)
  const translatedFields: Record<string, string> = {}
  for (const [field, key] of Object.entries(fieldErrors ?? {})) translatedFields[field] = t(key, key)
  const text = message ?? fallbackKey
  return createCrudFormError(t(text, t(fallbackKey, text)), translatedFields)
}
