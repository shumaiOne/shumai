import React from 'react'
import { Check, ChevronDown, Globe, Lock } from 'lucide-react'
import { m } from '@/ui/paraglide/messages.js'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'

export interface CommentVisibilitySelectorProps {
  isInternal: boolean
  onChange: (isInternal: boolean) => void
  disabled?: boolean
  disabledTooltip?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom'
}

export const CommentVisibilitySelector: React.FC<CommentVisibilitySelectorProps> = ({
  isInternal,
  onChange,
  disabled = false,
  disabledTooltip,
  align = 'end',
  side = 'top',
}) => {
  const pillClasses = `inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors shrink-0 select-none ${
    isInternal
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
      : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/80'
  } ${disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`

  const pillContent = (
    <>
      {isInternal ? <Lock className="w-3 h-3 shrink-0" /> : <Globe className="w-3 h-3 shrink-0" />}
      <span>{isInternal ? m.internal_comment_label() : m.public_comment_label()}</span>
      {!disabled && <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />}
    </>
  )

  if (disabled) {
    const button = (
      <button
        type="button"
        disabled
        data-testid="comment-visibility-trigger"
        className={pillClasses}
        onClick={(e) => e.stopPropagation()}
      >
        {pillContent}
      </button>
    )

    if (!disabledTooltip) return button

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">{button}</span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{disabledTooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="comment-visibility-trigger"
          className={pillClasses}
          onClick={(e) => e.stopPropagation()}
        >
          {pillContent}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        className="w-60"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          data-testid="comment-visibility-public"
          className="flex items-start gap-2.5 py-2 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            onChange(false)
          }}
        >
          <Globe className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground">{m.public_comment()}</div>
            <div className="text-[11px] text-muted-foreground leading-snug">
              {m.public_comment_description()}
            </div>
          </div>
          {!isInternal && <Check className="w-4 h-4 mt-0.5 shrink-0 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="comment-visibility-internal"
          className="flex items-start gap-2.5 py-2 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            onChange(true)
          }}
        >
          <Lock className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground">{m.internal_comment()}</div>
            <div className="text-[11px] text-muted-foreground leading-snug">
              {m.internal_comment_description()}
            </div>
          </div>
          {isInternal && <Check className="w-4 h-4 mt-0.5 shrink-0 text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
