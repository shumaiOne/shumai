import type { FieldInfo as MetadataFieldInfo } from '@/dtos/metadata'

export type FieldConfig = MetadataFieldInfo['config']

export interface FieldProps<T = unknown> {
  value: T
  config: FieldConfig
  onSave: (value: T) => void
  readOnly?: boolean
}
