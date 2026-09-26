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
import { TARGETS_LIST_HREF } from '../../../components/targets/target-form.component'

type TargetRow = {
  id: string
  name: string
  timeZone: string
  color: string | null
}

export default function TargetsPage() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<TargetRow[]>([])
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      const params = new URLSearchParams({ pageSize: '100' })
      if (search) params.set('search', search)
      const call = await apiCall<{ items: TargetRow[] }>(`/api/bookings/targets?${params.toString()}`)
      if (cancelled) return
      if (call.ok) setRows(call.result?.items ?? [])
      else flash(t('bookings.targets.messages.loadFailed', 'Failed to load targets.'), 'error')
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [search, reloadToken, scopeVersion, t])

  const handleDelete = React.useCallback(
    async (row: TargetRow) => {
      const confirmed = await confirm({
        title: t('bookings.targets.confirmDelete', 'Delete "{name}"?').replace('{name}', row.name),
        variant: 'destructive',
      })
      if (!confirmed) return
      try {
        await deleteCrud('bookings/targets', row.id)
        flash(t('bookings.targets.messages.deleted', 'Target deleted.'), 'success')
        setReloadToken((token) => token + 1)
      } catch (error) {
        flash(translatedCrudError(error, t, 'bookings.targets.messages.deleteFailed').message, 'error')
      }
    },
    [confirm, t]
  )

  const columns = React.useMemo<ColumnDef<TargetRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('bookings.targets.columns.name', 'Name'),
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: row.original.color ?? undefined }} />
            <span className="font-medium">{row.original.name}</span>
          </span>
        ),
      },
      {
        accessorKey: 'timeZone',
        header: t('bookings.targets.columns.timeZone', 'Time zone'),
      },
    ],
    [t]
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('bookings.targets.list.title', 'Targets')}
          columns={columns}
          data={rows}
          isLoading={isLoading}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('bookings.targets.list.search', 'Search targets')}
          actions={
            <Button asChild>
              <Link href={`${TARGETS_LIST_HREF}/create`}>
                <Plus className="size-4" />
                {t('bookings.targets.list.create', 'New target')}
              </Link>
            </Button>
          }
          rowActions={(row) => (
            <RowActions
              items={[
                { id: 'edit', label: t('bookings.actions.edit', 'Edit'), href: `${TARGETS_LIST_HREF}/${row.id}` },
                { id: 'delete', label: t('bookings.actions.delete', 'Delete'), destructive: true, onSelect: () => void handleDelete(row) },
              ]}
            />
          )}
          perspective={{ tableId: 'bookings.targets.list' }}
        />
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}
