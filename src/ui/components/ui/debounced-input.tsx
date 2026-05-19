import * as React from 'react'
import { Input } from './input'

interface DebouncedInputProps
  extends Omit<React.ComponentProps<typeof Input>, 'onChange' | 'value'> {
  value: string | number
  onChange: (value: string | number) => void
  debounce?: number
}

export function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: DebouncedInputProps) {
  const [value, setValue] = React.useState(initialValue)

  React.useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (value !== initialValue) {
        onChange(value)
      }
    }, debounce)

    return () => clearTimeout(timeout)
  }, [value, debounce, onChange, initialValue])

  return <Input {...props} value={value} onChange={(e) => setValue(e.target.value)} />
}
