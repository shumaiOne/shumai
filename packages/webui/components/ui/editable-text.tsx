import { Input } from '@/ui/components/ui/input'
import { cn } from '@/ui/lib/utils'
import React from 'react'

export type EditableTextProps = React.ComponentPropsWithoutRef<'input'>

const EditableText = React.forwardRef<HTMLInputElement, EditableTextProps>(
  ({ className, onClick, onMouseDown, disabled, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        readOnly={disabled}
        tabIndex={disabled ? -1 : undefined}
        className={cn(
          'h-auto min-h-0 w-full rounded-sm border px-1 py-0.5 text-base shadow-none transition-all outline-none focus-visible:ring-0',
          !disabled
            ? 'border-blue-500 !bg-muted/10 ring-1 ring-blue-500'
            : 'border-transparent !bg-transparent cursor-default opacity-100 focus-visible:border-transparent focus-visible:ring-0 caret-transparent select-none',
          className,
        )}
        onClick={(e) => {
          if (!disabled) {
            e.stopPropagation()
          }
          onClick?.(e)
        }}
        onMouseDown={(e) => {
          if (!disabled) {
            e.stopPropagation()
          }
          onMouseDown?.(e)
        }}
        {...props}
      />
    )
  },
)

EditableText.displayName = 'EditableText'

export { EditableText }
