import type { FieldInfo as MetadataFieldInfo } from '@/dtos/metadata'
import React from 'react'

interface FieldProps {
  value: boolean
  config: MetadataFieldInfo['config']
  onSave: (value: boolean) => void
  readOnly?: boolean
}

const ToggleField: React.FC<FieldProps> = ({ value, onSave, readOnly }) => {
  // Toggle is instant edit, doesn't really have a separate "Edit mode" UI structure other than interaction.
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!readOnly) {
      const newValue = !value
      onSave(newValue)
    }
  }

  return (
    <div
      onClick={handleToggle}
      className={`flex items-center h-[28px] w-full ${!readOnly ? 'cursor-pointer' : ''}`}
    >
      <div
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
          value ? 'bg-green-500' : 'bg-gray-300'
        } ${readOnly ? 'opacity-70' : ''}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-200 ease-in-out ${
            value ? 'translate-x-4.5' : 'translate-x-1'
          }`}
          style={{ transform: value ? 'translateX(18px)' : 'translateX(4px)' }}
        />
      </div>
    </div>
  )
}

export default ToggleField
