import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import type { SubjectKind } from '../../services/subjects/providers/provider'

const KIND_LABELS: Record<SubjectKind, readonly [key: string, fallback: string]> = {
  person: ['bookings.subjects.kind.person', 'Person'],
  team: ['bookings.subjects.kind.team', 'Team or crew'],
  resource: ['bookings.subjects.kind.resource', 'Equipment, room or vehicle'],
}

export function subjectKindLabel(kind: SubjectKind | null, t: TranslateFn): string {
  if (!kind) return t('bookings.subjects.kind.unavailable', 'Registry disabled')
  const [key, fallback] = KIND_LABELS[kind]
  return t(key, fallback)
}
