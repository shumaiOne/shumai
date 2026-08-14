import type { UserInfo } from '@shumai/dtos'
import { Check } from 'lucide-react'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FieldProps } from './field-types'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/ui/popover'
import { useMemberStore } from '@/ui/stores/members'
import { useTeamId } from '@/ui/hooks/use-team-id'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'

const UserMultiField: React.FC<FieldProps<string[]>> = ({ value = [], onSave, readOnly }) => {
  const teamId = useTeamId()
  const { members, fetchMembers } = useMemberStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [visibleCount, setVisibleCount] = useState(value.length)

  useEffect(() => {
    if (teamId) {
      fetchMembers(teamId)
    }
  }, [teamId, fetchMembers])

  const selectedUsers = members.filter((m) => (value || []).includes(m.id))

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  // Dynamic calculation for how many items fit in one line
  useLayoutEffect(() => {
    if (isEditing) {
      setVisibleCount(selectedUsers.length)
      return
    }

    if (containerRef.current) {
      const innerWidth = containerRef.current.clientWidth - 8 // account for px-1 (8px padding)
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (context && innerWidth > 0) {
        context.font = '500 12px ui-sans-serif, system-ui, sans-serif'
        const gap = 4
        const badgeWidths = selectedUsers.map((user) => {
          const textWidth = Math.min(100, Math.ceil(context.measureText(user.name).width))
          // 16px padding + 2px border + 16px avatar + 6px gap = 40px
          return textWidth + 40
        })
        const totalAllWidth =
          badgeWidths.reduce((a, b) => a + b, 0) + Math.max(0, badgeWidths.length - 1) * gap

        if (totalAllWidth <= innerWidth) {
          setVisibleCount(selectedUsers.length)
          return
        }

        const moreBadgeWidth = 32
        const maxAvailableWidth = innerWidth - moreBadgeWidth - gap
        let currentWidth = 0
        let count = 0

        for (let i = 0; i < badgeWidths.length; i++) {
          const widthWithGap = count > 0 ? currentWidth + gap + badgeWidths[i] : badgeWidths[i]
          if (widthWithGap > maxAvailableWidth) break
          currentWidth = widthWithGap
          count++
        }
        setVisibleCount(count)
      }
    }
  }, [selectedUsers, isEditing, value])

  const toggleUser = (userId: string) => {
    const currentVal = value || []
    let newVal
    if (currentVal.includes(userId)) {
      newVal = currentVal.filter((id) => id !== userId)
    } else {
      newVal = [...currentVal, userId]
    }
    onSave(newVal)
  }

  const handlePlaceholderClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!readOnly) {
      setIsEditing(true)
    }
  }

  const hiddenCount = selectedUsers.length - visibleCount

  const handleOpenChange = (open: boolean) => {
    if (readOnly) return
    setIsEditing(open)
  }

  const renderUserBadge = (user: UserInfo) => {
    return (
      <span
        key={user.id}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground border whitespace-nowrap h-[22px]"
      >
        <Avatar className="w-4 h-4">
          <AvatarImage src={user.image} alt={user.name} className="object-cover" />
          <AvatarFallback className="text-[8px] bg-rose-400 text-black font-semibold">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <span className="truncate max-w-[100px]">{user.name}</span>
      </span>
    )
  }

  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
      <Popover open={!readOnly && isEditing} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <div
            ref={containerRef}
            onClick={handlePlaceholderClick}
            className={`w-full px-1 py-1 flex flex-wrap gap-1 rounded border border-transparent transition-all box-border h-[32px] overflow-hidden ${
              !readOnly || hiddenCount > 0
                ? 'cursor-pointer hover:bg-accent hover:border-border'
                : ''
            }`}
          >
            {selectedUsers.length === 0 && (
              <span className="text-muted-foreground text-sm italic px-1 pt-0.5">Empty</span>
            )}

            {selectedUsers.slice(0, visibleCount).map(renderUserBadge)}

            {hiddenCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground h-[22px]">
                +{hiddenCount}
              </span>
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent
          className="p-1 w-[--radix-popover-trigger-width] min-w-[200px] max-h-60 overflow-auto bg-popover border border-border rounded-lg shadow-lg"
          align="start"
        >
          {members.map((user) => {
            const isSelected = (value || []).includes(user.id)
            return (
              <div
                key={user.id}
                onClick={() => toggleUser(user.id)}
                className="px-3 py-2 hover:bg-accent cursor-pointer flex items-center justify-between rounded-sm"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={user.image} alt={user.name} className="object-cover" />
                    <AvatarFallback className="text-[10px] bg-rose-400 text-black font-semibold">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground">{user.name}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-primary" />}
              </div>
            )
          })}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default UserMultiField
