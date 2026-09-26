'use client'

import * as React from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { Button } from '@open-mercato/ui/primitives/button'
import { translatedCrudError } from '../../../components/shared/translated-crud-error'
import { CATEGORIES_LIST_HREF } from '../../../components/subjects/category-form.component'
import { categoryIcon } from '../../../components/subjects/category-icons'

type CategoryRow = {
  id: string
  name: string
  icon: string | null
  color: string | null
}

export default function CategoriesPage() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<CategoryRow[]>([])
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      const params = new URLSearchParams({ pageSize: '100' })
      if (search) params.set('search', search)
      const call = await apiCall<{ items: CategoryRow[] }>(`/api/bookings/subject-categories?${params.toString()}`)
      if (cancelled) return
      if (call.ok) setRows(call.result?.items ?? [])
      else flash(t('bookings.categories.messages.loadFailed', 'Failed to load categories.'), 'error')
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [search, reloadToken, scopeVersion, t])

  const handleDelete = React.useCallback(
    async (row: CategoryRow) => {
      const confirmed = await confirm({
        title: t('bookings.categories.confirmDelete', 'Delete "{name}"?', { name: row.name }),
        variant: 'destructive',
      })
      if (!confirmed) return
      try {
        await deleteCrud('bookings/subject-categories', row.id)
        flash(t('bookings.categories.messages.deleted', 'Category deleted.'), 'success')
        setReloadToken((token) => token + 1)
      } catch (error) {
        flash(translatedCrudError(error, t, 'bookings.categories.messages.deleteFailed').message, 'error')
      }
    },
    [confirm, t]
  )

  const columns = React.useMemo<ColumnDef<CategoryRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('bookings.categories.columns.name', 'Name'),
        cell: ({ row }) => {
          const Icon = categoryIcon(row.original.icon)
          return (
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: row.original.color ?? undefined }}
              >
                <Icon className="size-3.5" />
              </span>
              <span className="font-medium">{row.original.name}</span>
            </span>
          )
        },
      },
    ],
    [t]
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('bookings.categories.list.title', 'Subject categories')}
          columns={columns}
          data={rows}
          isLoading={isLoading}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('bookings.categories.list.search', 'Search categories')}
          actions={
            <Button asChild>
              <Link href={`${CATEGORIES_LIST_HREF}/create`}>
                <Plus className="size-4" />
                {t('bookings.categories.list.create', 'New category')}
              </Link>
            </Button>
          }
          rowActions={(row) => (
            <RowActions
              items={[
                { id: 'edit', label: t('bookings.actions.edit', 'Edit'), href: `${CATEGORIES_LIST_HREF}/${row.id}` },
                { id: 'delete', label: t('bookings.actions.delete', 'Delete'), destructive: true, onSelect: () => void handleDelete(row) },
              ]}
            />
          )}
          perspective={{ tableId: 'bookings.categories.list' }}
        />
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}
