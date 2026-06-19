import { Switch } from '@/ui/components/ui/switch'
import type { FieldInfo as MetadataFieldInfo } from '@shumai/dtos'
import React from 'react'

interface FieldProps {
  value: boolean
  config: MetadataFieldInfo['config']
  onSave: (value: boolean) => void
  readOnly?: boolean
}

const ToggleField: React.FC<FieldProps> = ({ value, onSave, readOnly }) => {
  const handleToggle = (checked: boolean) => {
    if (!readOnly) {
      onSave(checked)
    }
  }

  return (
    <div className="flex items-center h-[28px] w-full" onClick={(e) => e.stopPropagation()}>
      <Switch
        checked={value}
        onCheckedChange={handleToggle}
        disabled={readOnly}
        className="cursor-pointer"
      />
    </div>
  )
}

export default ToggleField
