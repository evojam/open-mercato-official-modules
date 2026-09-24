'use client'

import * as React from 'react'
import { Button } from '@open-mercato/ui/primitives/button'

export type SettingsSectionProps = {
  title: string
  description: string
  saveLabel: string
  saving: boolean
  disabled: boolean
  onSave: () => void
  children: React.ReactNode
}

export function SettingsSection({ title, description, saveLabel, saving, disabled, onSave, children }: SettingsSectionProps) {
  return (
    <section className="space-y-4 rounded-none border bg-card/30 p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
      <div className="flex justify-end">
        <Button type="button" onClick={onSave} disabled={disabled || saving}>
          {saveLabel}
        </Button>
      </div>
    </section>
  )
}
