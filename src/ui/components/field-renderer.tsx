import type { FieldInfo as FieldInfo } from '@/dtos/metadata'
import React from 'react'
import DateField from './fields/date-field'
import LongTextField from './fields/long-text-field'
import NumberField from './fields/number-field'
import RatingField from './fields/rating-field'
import SelectField from './fields/select-field'
import SelectMultiField from './fields/select-multi-field'
import TextField from './fields/text-field'
import ToggleField from './fields/toggle-field'

interface FieldRendererProps {
  config: FieldInfo['config']
  value: unknown
  onSave: (value: unknown) => void
  readOnly?: boolean
}

const FieldRenderer: React.FC<FieldRendererProps> = (props) => {
  if (!props.config) {
    return <div>Unknown Field Type</div>
  }
  switch (props.config.type) {
    case 'text':
      return (
        <TextField
          {...props}
          value={props.value as string}
          onSave={props.onSave as (value: string) => void}
        />
      )
    case 'longText':
      return (
        <LongTextField
          {...props}
          value={props.value as string}
          onSave={props.onSave as (value: string) => void}
        />
      )
    case 'select':
      return (
        <SelectField
          {...props}
          value={props.value as string}
          onSave={props.onSave as (value: string) => void}
        />
      )
    case 'selectMulti':
      return (
        <SelectMultiField
          {...props}
          value={props.value as string[]}
          onSave={props.onSave as (value: string[]) => void}
        />
      )
    case 'rating':
      return (
        <RatingField
          {...props}
          value={props.value as number}
          onSave={props.onSave as (value: number) => void}
        />
      )
    case 'number':
      return (
        <NumberField
          {...props}
          value={props.value as number}
          onSave={props.onSave as (value: number | undefined) => void}
        />
      )
    case 'toggle':
      return (
        <ToggleField
          {...props}
          value={props.value as boolean}
          onSave={props.onSave as (value: boolean) => void}
        />
      )
    case 'date':
      return (
        <DateField
          {...props}
          value={props.value as string}
          onSave={props.onSave as (value: string) => void}
        />
      )
    default:
      return <div>Unknown Field Type</div>
  }
}

export default FieldRenderer
