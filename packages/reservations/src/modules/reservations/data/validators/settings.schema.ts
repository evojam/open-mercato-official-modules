import { z } from 'zod'
import { settingsDtoSchema } from './dto.schema'

export const replaceSettingsSchema = settingsDtoSchema
export type ReplaceSettingsInput = z.output<typeof replaceSettingsSchema>
