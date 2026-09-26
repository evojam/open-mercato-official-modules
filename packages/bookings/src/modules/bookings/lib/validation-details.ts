import type { ZodError } from 'zod'

export type ValidationDetail = {
  path: Array<string | number>
  message: string
}

export function validationDetails(error: ZodError): ValidationDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.filter((part): part is string | number => typeof part !== 'symbol'),
    message: issue.message,
  }))
}
