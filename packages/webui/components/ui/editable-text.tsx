import { Input } from '@/ui/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/ui/components/ui/tooltip'
import { cn } from '@/ui/lib/utils'
import React, { useRef, useState } from 'react'

export type EditableTextProps = React.ComponentPropsWithoutRef<'input'> & {
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
  tooltipDelayDuration?: number
}

const EditableText = React.forwardRef<HTMLInputElement, EditableTextProps>(
  (
    {
      className,
      onClick,
      onMouseDown,
      disabled,
      value,
      title: _title,
      tooltipSide = 'top',
      tooltipDelayDuration = 100,
      ...props
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(false)
    const spanRef = useRef<HTMLSpanElement>(null)

    const textContent = typeof value === 'string' ? value : (value?.toString() ?? '')

    if (disabled) {
      return (
        <TooltipProvider delayDuration={tooltipDelayDuration}>
          <Tooltip
            open={isOpen}
            onOpenChange={(nextOpen) => {
              if (nextOpen) {
                if (spanRef.current && spanRef.current.scrollWidth > spanRef.current.clientWidth) {
                  setIsOpen(true)
                } else {
                  setIsOpen(false)
                }
              } else {
                setIsOpen(false)
              }
            }}
          >
            <TooltipTrigger asChild>
              <span
                ref={spanRef}
                className={cn(
                  'box-border block min-w-0 w-full rounded-sm border border-transparent px-1 py-0.5 text-base shadow-none transition-all outline-none cursor-default opacity-100 select-none truncate',
                  className,
                )}
                onClick={onClick}
                onMouseDown={onMouseDown}
              >
                {textContent}
              </span>
            </TooltipTrigger>
            {isOpen && (
              <TooltipContent
                side={tooltipSide}
                className="max-w-md break-all text-wrap [text-wrap:normal] text-left"
              >
                {textContent}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      )
    }

    return (
      <Input
        ref={ref}
        value={value}
        tabIndex={0}
        className={cn(
          'box-border block min-w-0 h-auto w-full rounded-sm border border-blue-500 !bg-muted/10 ring-1 ring-blue-500 px-1 py-0.5 text-base shadow-none transition-all outline-none focus-visible:ring-0',
          className,
        )}
        onClick={(e) => {
          e.stopPropagation()
          onClick?.(e)
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
          onMouseDown?.(e)
        }}
        {...props}
      />
    )
  },
)

EditableText.displayName = 'EditableText'

export { EditableText }
