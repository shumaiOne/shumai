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
  const [expanded, setExpanded] = useState(false)
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
    if (isEditing || expanded) {
      setVisibleCount(selectedUsers.length)
      return
    }

    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (context) {
        context.font = '12px ui-sans-serif, system-ui, sans-serif'

        let currentWidth = 0
        let count = 0
        const moreBadgeWidth = 28
        const maxAvailableWidth = containerWidth - moreBadgeWidth

        for (let i = 0; i < selectedUsers.length; i++) {
          const textWidth = context.measureText(selectedUsers[i].name).width
          // 16px padding + 16px avatar + 6px gap + 4px extra gap
          const badgeWidth = textWidth + 42

          if (currentWidth + badgeWidth > maxAvailableWidth && i < selectedUsers.length - 1) {
            break
          }
          if (i === selectedUsers.length - 1) {
            if (currentWidth + badgeWidth <= containerWidth) {
              count++
            }
            break
          }

          currentWidth += badgeWidth
          count++
        }
        setVisibleCount(count)
      }
    }
  }, [selectedUsers, isEditing, expanded, value])

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
    if (isEditing) return

    const hiddenCount = selectedUsers.length - visibleCount
    if (!expanded && hiddenCount > 0) {
      setExpanded(true)
    } else {
      if (!readOnly) {
        setIsEditing(true)
      }
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!readOnly) {
      setIsEditing(true)
    }
  }

  const hiddenCount = selectedUsers.length - visibleCount
  const isOpen = (expanded && !isEditing) || isEditing

  const handleOpenChange = (open: boolean) => {
    if (readOnly) return
    if (!open) {
      setExpanded(false)
      setIsEditing(false)
    }
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
      <Popover open={!readOnly && isOpen} onOpenChange={handleOpenChange}>
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
          className={`p-1 bg-popover border rounded-lg shadow-xl max-h-60 overflow-auto ${
            expanded && !isEditing
              ? 'w-[--radix-popover-trigger-width] min-w-[200px] flex flex-wrap gap-1 border-ring min-h-[32px] h-auto cursor-pointer'
              : 'w-64 border-border'
          }`}
          align="start"
          onClick={expanded && !isEditing ? handleOverlayClick : undefined}
        >
          {expanded && !isEditing ? (
            <>
              {selectedUsers.length === 0 && (
                <span className="text-muted-foreground text-sm italic px-1 pt-0.5">Empty</span>
              )}
              {selectedUsers.map(renderUserBadge)}
            </>
          ) : (
            members.map((user) => {
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
            })
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default UserMultiField
