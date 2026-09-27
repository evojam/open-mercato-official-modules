'use client'

import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { Button } from '@open-mercato/ui/primitives/button'
import { translatedCrudError } from '../../../components/shared/translated-crud-error'
import {
  AddSubjectDialog,
  type SubjectCategoryOption,
  type SubjectProviderOption,
} from '../../../components/subjects/add-subject-dialog.component'
import { categoryIcon } from '../../../components/subjects/category-icons'
import { BOOKINGS_API_PATHS } from '../../../lib/api-paths'

const SUBJECTS_LIST_HREF = '/backend/bookings/subjects'

type SubjectRow = {
  id: string
  name: string
  kind: 'person' | 'resource' | null
  providerAvailable: boolean
  cardHref: string | null
  category: { id: string; name: string; icon: string | null; color: string | null } | null
  timeZone: string
  isActive: boolean
}

export default function SubjectsPage() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<SubjectRow[]>([])
  const [providers, setProviders] = React.useState<SubjectProviderOption[]>([])
  const [categories, setCategories] = React.useState<SubjectCategoryOption[]>([])
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [adding, setAdding] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const [providersCall, categoriesCall] = await Promise.all([
        apiCall<{ items: SubjectProviderOption[] }>(BOOKINGS_API_PATHS.subjectProviders),
        apiCall<{ items: SubjectCategoryOption[] }>(BOOKINGS_API_PATHS.subjectCategories),
      ])
      if (cancelled) return
      setProviders(providersCall.ok ? providersCall.result?.items ?? [] : [])
      setCategories(categoriesCall.ok ? (categoriesCall.result?.items ?? []).map(({ id, name }) => ({ id, name })) : [])
    })()
    return () => {
      cancelled = true
    }
  }, [scopeVersion])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      const params = new URLSearchParams({ pageSize: '100' })
      if (search) params.set('search', search)
      const call = await apiCall<{ items: SubjectRow[] }>(`${BOOKINGS_API_PATHS.subjects}?${params.toString()}`)
      if (cancelled) return
      if (call.ok) setRows(call.result?.items ?? [])
      else flash(t('bookings.subjects.messages.loadFailed', 'Failed to load subjects.'), 'error')
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [search, reloadToken, scopeVersion, t])

  const setActive = React.useCallback(
    async (row: SubjectRow, isActive: boolean) => {
      try {
        await updateCrud('bookings/subjects', { id: row.id, isActive })
        flash(
          isActive ? t('bookings.subjects.messages.activated', 'Subject is in use again.') : t('bookings.subjects.messages.deactivated', 'Subject is no longer in use.'),
          'success'
        )
        setReloadToken((token) => token + 1)
      } catch (error) {
        flash(translatedCrudError(error, t, 'bookings.subjects.errors.saveFailed').message, 'error')
      }
    },
    [t]
  )

  const columns = React.useMemo<ColumnDef<SubjectRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('bookings.subjects.columns.name', 'Name'),
        cell: ({ row }) => {
          const Icon = categoryIcon(row.original.category?.icon)
          return (
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-white"
                style={row.original.category?.color ? { backgroundColor: row.original.category.color } : undefined}
              >
                <Icon className="size-3.5" />
              </span>
              <span className={row.original.isActive ? 'font-medium' : 'font-medium text-muted-foreground line-through'}>
                {row.original.name}
              </span>
            </span>
          )
        },
      },
      {
        id: 'kind',
        header: t('bookings.subjects.columns.kind', 'What it is'),
        cell: ({ row }) =>
          row.original.kind === 'person'
            ? t('bookings.subjects.kind.person', 'Person')
            : row.original.kind === 'resource'
              ? t('bookings.subjects.kind.resource', 'Equipment, room or vehicle')
              : t('bookings.subjects.kind.unavailable', 'Registry disabled'),
      },
      {
        id: 'category',
        header: t('bookings.subjects.columns.category', 'Category'),
        cell: ({ row }) => row.original.category?.name ?? '—',
      },
      {
        accessorKey: 'timeZone',
        header: t('bookings.subjects.columns.timeZone', 'Time zone'),
      },
    ],
    [t]
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('bookings.subjects.list.title', 'Subjects')}
          columns={columns}
          data={rows}
          isLoading={isLoading}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('bookings.subjects.list.search', 'Search subjects')}
          actions={
            <Button type="button" onClick={() => setAdding(true)} disabled={providers.length === 0}>
              <Plus className="size-4" />
              {t('bookings.subjects.list.add', 'Add subject')}
            </Button>
          }
          rowActions={(row) => (
            <RowActions
              items={[
                { id: 'edit', label: t('bookings.actions.edit', 'Edit'), href: `${SUBJECTS_LIST_HREF}/${row.id}` },
                ...(row.cardHref
                  ? [{ id: 'card', label: t('bookings.subjects.actions.openCard', 'Open in registry'), href: row.cardHref }]
                  : []),
                row.isActive
                  ? { id: 'deactivate', label: t('bookings.subjects.actions.deactivate', 'Stop using'), onSelect: () => void setActive(row, false) }
                  : { id: 'activate', label: t('bookings.subjects.actions.activate', 'Use again'), onSelect: () => void setActive(row, true) },
              ]}
            />
          )}
          perspective={{ tableId: 'bookings.subjects.list' }}
        />
        <AddSubjectDialog
          open={adding}
          providers={providers}
          categories={categories}
          onOpenChange={setAdding}
          onAdded={() => setReloadToken((token) => token + 1)}
        />
      </PageBody>
    </Page>
  )
}
