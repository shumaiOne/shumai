import * as React from 'react'
import { EmojiPicker } from '@ferrucc-io/emoji-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { m } from '@/ui/paraglide/messages.js'
import { cn } from '@/ui/lib/utils'

export interface EmojiPickerPopoverProps {
  onEmojiSelect: (emoji: string) => void
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function EmojiPickerPopover({
  onEmojiSelect,
  children,
  align = 'end',
  side = 'top',
  sideOffset = 4,
  className,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: EmojiPickerPopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen)
      }
      setControlledOpen?.(nextOpen)
    },
    [isControlled, setControlledOpen],
  )

  const handleSelect = React.useCallback(
    (emoji: string) => {
      onEmojiSelect(emoji)
      handleOpenChange(false)
    },
    [onEmojiSelect, handleOpenChange],
  )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={sideOffset}
        className={cn('w-auto p-0 border-border bg-popover shadow-lg overflow-hidden', className)}
        onClick={(e) => e.stopPropagation()}
      >
        <EmojiPicker
          onEmojiSelect={handleSelect}
          emojisPerRow={9}
          emojiSize={28}
          className="border-none w-[320px] bg-popover"
        >
          <EmojiPicker.Header className="p-2 pb-1">
            <EmojiPicker.Input
              placeholder={m.search_emoji()}
              autoFocus={true}
              className="h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </EmojiPicker.Header>
          <EmojiPicker.Group>
            <EmojiPicker.List containerHeight={280} />
          </EmojiPicker.Group>
        </EmojiPicker>
      </PopoverContent>
    </Popover>
  )
}
