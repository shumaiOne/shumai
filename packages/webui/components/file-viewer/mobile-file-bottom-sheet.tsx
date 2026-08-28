import { client } from '@/ui/api/client'
import { MessageCard } from '@/ui/components/chat/message-card'
import { ChatInput } from '@/ui/components/chat/message-input'
import FieldRenderer from '@/ui/components/field-renderer'
import { GuestIdentityPopup } from '@/ui/components/guest-identity-popup'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/ui/tabs'
import { getViewerForFile } from '@/ui/components/viewers/registry'
import { usePermissions } from '@/ui/hooks/use-permissions'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'
import { useFieldStore } from '@/ui/stores/fields'
import type { MemberInfo } from '@/ui/stores/members'
import type { Annotation } from '@/ui/types'
import type { AssetInfo, AttachmentInfo, CommentInfo, FieldValueInfo } from '@shumai/dtos'
import { type FieldInfo as MetadataFieldInfo } from '@shumai/dtos'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInView } from 'react-intersection-observer'

export interface MobileFileBottomSheetProps {
  teamId: string
  projectId: string
  file: AssetInfo | null
  onSaveField: (fieldId: string, value: unknown) => void
  members: MemberInfo[]
  onCommentSelect?: (comment: CommentInfo) => void
  hideAnnotationControl?: boolean
  readOnly?: boolean
  publicFields?: MetadataFieldInfo[]
  isPublic?: boolean
  shareId?: string
  currentTime?: number
  onTyping?: () => void
  selectedCommentId?: string | null
  heightPercent: number
  onHeightPercentChange: (height: number) => void
}

export function MobileFileBottomSheet({
  teamId,
  projectId,
  file,
  onSaveField,
  members,
  onCommentSelect,
  hideAnnotationControl = false,
  readOnly = false,
  publicFields,
  isPublic = false,
  shareId,
  currentTime,
  onTyping,
  selectedCommentId,
  heightPercent,
  onHeightPercentChange,
}: MobileFileBottomSheetProps) {
  const { canEdit } = usePermissions(projectId)
  const { fields, setFields } = useFieldStore()
  const queryClient = useQueryClient()
  const { ref, inView } = useInView()
  const [replyingTo, setReplyingTo] = useState<CommentInfo | null>(null)
  const [viewingAttachment, setViewingAttachment] = useState<AttachmentInfo | null>(null)
  const [isGuestPopupOpen, setIsGuestPopupOpen] = useState(false)
  const [pendingComment, setPendingComment] = useState<{
    text: string
    attachmentIds: string[]
    annotations?: Annotation[]
    replyToId?: string | null
    second?: number | null
  } | null>(null)

  // Dragging state
  const isDragging = useRef(false)
  const dragStartY = useRef(0)
  const dragStartHeightPercent = useRef(heightPercent)

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true
    dragStartY.current = e.clientY
    dragStartHeightPercent.current = heightPercent
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return
      const deltaY = dragStartY.current - e.clientY
      const deltaPercent = (deltaY / window.innerHeight) * 100
      const newHeight = Math.min(92, Math.max(10, dragStartHeightPercent.current + deltaPercent))
      onHeightPercentChange(newHeight)
    },
    [onHeightPercentChange],
  )

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false
    try {
      ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    } catch {
      // Ignore
    }
  }

  const { data: apiFields } = useQuery({
    queryKey: ['fields', projectId],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].fields.$get({
        param: { projectId: projectId },
      })
      if (!res.ok) throw new Error('Failed to fetch fields')
      return await res.json()
    },
    enabled: !!projectId && !publicFields,
  })

  const viewerDef = getViewerForFile(file)

  useEffect(() => {
    if (publicFields) {
      setFields(publicFields, projectId)
    } else if (apiFields) {
      setFields(apiFields as unknown as MetadataFieldInfo[], projectId)
    }
  }, [apiFields, publicFields, projectId, setFields])

  const {
    data: commentsData,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: isPublic
      ? ['shares', shareId, 'files', file?.id, 'comments']
      : ['files', file?.id, 'comments'],
    queryFn: async ({ pageParam }) => {
      if (isPublic) {
        const password = localStorage.getItem(`share_pwd_${shareId}`) || ''
        const res = await client.api.shares[':shareId'].files[':fileId'].comments.$get(
          {
            param: { shareId: shareId!, fileId: file!.id! },
            query: { after: pageParam as string },
          },
          {
            headers: {
              'x-share-password': password,
            },
          },
        )
        if (!res.ok) throw new Error('Failed to fetch comments')
        return await res.json()
      } else {
        const res = await client.api.files[':fileId'].comments.$get({
          param: { fileId: file!.id! },
          query: { after: pageParam as string },
        })
        if (!res.ok) throw new Error('Failed to fetch comments')
        return await res.json()
      }
    },
    enabled: !!file?.id && (!isPublic || !!shareId),
    initialPageParam: '',
    refetchInterval: 2000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getNextPageParam: (lastPage: any) => lastPage.pageInfo?.cursor || undefined,
  })

  const { mutate: createComment } = useMutation({
    mutationFn: async ({
      text,
      attachmentIds,
      annotations,
      replyToId,
      guestUserId,
      second,
    }: {
      text: string
      attachmentIds: string[]
      annotations?: Annotation[]
      replyToId?: string | null
      guestUserId?: string
      second?: number | null
    }) => {
      if (isPublic) {
        const password = localStorage.getItem(`share_pwd_${shareId}`) || ''
        const res = await client.api.shares[':shareId'].files[':fileId'].comments.$post(
          {
            param: { shareId: shareId!, fileId: file!.id! },
            json: {
              message: text,
              attachmentIds: attachmentIds,
              replyToId: replyToId ?? undefined,
              annotations: annotations,
              second: second ?? undefined,
            },
          },
          {
            headers: {
              'x-share-password': password,
              ...(guestUserId ? { 'x-guest-user-id': guestUserId } : {}),
            },
          },
        )
        if (!res.ok) throw new Error('Failed to create comment')
        return await res.json()
      } else {
        const res = await client.api.files[':fileId'].comments.$post({
          param: { fileId: file!.id! },
          json: {
            message: text,
            attachmentIds: attachmentIds,
            replyToId: replyToId ?? undefined,
            annotations: annotations,
            second: second ?? undefined,
          },
        })
        if (!res.ok) throw new Error('Failed to create comment')
        return await res.json()
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: isPublic
          ? ['shares', shareId, 'files', file?.id, 'comments']
          : ['files', file?.id, 'comments'],
      })
    },
  })

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage()
    }
  }, [inView, fetchNextPage, hasNextPage])

  const itemFieldValueMap = useMemo(() => {
    return (file?.fieldValues || []).reduce(
      (acc: Record<string, FieldValueInfo>, val: FieldValueInfo) => {
        acc[val.fieldId!] = val
        return acc
      },
      {},
    )
  }, [file?.fieldValues])

  const sortedFields = useMemo(() => {
    return [...fields].sort((a, b) => {
      const nameA = a.config?.name?.toLowerCase() || ''
      const nameB = b.config?.name?.toLowerCase() || ''
      if (nameA < nameB) return -1
      if (nameA > nameB) return 1
      return 0
    })
  }, [fields])

  const comments =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (commentsData?.pages.flatMap((page: any) => page.data ?? []) as CommentInfo[]) ?? []

  const handleSendMessage = async (
    text: string,
    attachmentIds: string[],
    annotations?: Annotation[],
    replyToId?: string | null,
    second?: number | null,
  ) => {
    if (!file?.id) return

    if (isPublic) {
      const meRes = await client.api.me.$get()
      const { id: loggedInUserId } = await meRes.json()

      if (!loggedInUserId) {
        const guestUserId = localStorage.getItem('guest_user_id')
        if (!guestUserId) {
          setPendingComment({ text, attachmentIds, annotations, replyToId, second })
          setIsGuestPopupOpen(true)
          return
        }
        createComment({ text, attachmentIds, annotations, replyToId, guestUserId, second })
      } else {
        createComment({ text, attachmentIds, annotations, replyToId, second })
      }
    } else {
      createComment({ text, attachmentIds, annotations, replyToId, second })
    }
    setReplyingTo(null)
  }

  const handleGuestSuccess = (guestUserId: string) => {
    if (pendingComment) {
      createComment({ ...pendingComment, guestUserId })
      setPendingComment(null)
      setReplyingTo(null)
    }
  }

  const getUser = (id: string): MemberInfo => {
    const member = members.find((m) => m.id === id)
    if (member) {
      return member
    }

    return {
      id: 'unknown',
      name: 'Unknown',
      role: 'unknown',
    }
  }

  const isCollapsed = heightPercent <= 15

  return (
    <div
      style={{ height: `${heightPercent}vh` }}
      className="fixed bottom-0 left-0 right-0 z-30 flex flex-col bg-background border-t border-border shadow-2xl rounded-t-2xl overflow-hidden transition-[height] duration-75 ease-out select-none"
      data-testid="mobile-bottom-sheet"
    >
      {/* Lightbox for attachment viewing */}
      {viewingAttachment && viewingAttachment.proxyType === 'image' && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setViewingAttachment(null)}
        >
          <button className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors z-50">
            <XIcon className="w-8 h-8" />
          </button>

          <div className="w-full h-full flex items-center justify-center p-2">
            <img
              src={viewingAttachment.url}
              alt="Enlarged view"
              className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl cursor-zoom-out"
              onClick={() => setViewingAttachment(null)}
            />
          </div>
        </div>
      )}

      {/* Drag Handle Bar */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full pt-2 pb-1.5 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none shrink-0"
        aria-label="Drag to resize bottom sheet"
      >
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30 hover:bg-muted-foreground/50 transition-colors" />
      </div>

      {/* Tabs Header */}
      <Tabs
        defaultValue="comments"
        className="flex-1 flex flex-col min-h-0 px-2 pb-1 overflow-hidden"
      >
        <TabsList className="w-full shrink-0 h-9 bg-muted/60 p-1">
          <TabsTrigger value="comments" className="flex-1 text-xs font-semibold py-1">
            {m.comments()} {comments.length > 0 && `(${comments.length})`}
          </TabsTrigger>
          <TabsTrigger value="fields" className="flex-1 text-xs font-semibold py-1">
            {m.fields()}
          </TabsTrigger>
        </TabsList>

        {/* Comments Tab Content */}
        <TabsContent
          value="comments"
          className={cn(
            'flex-1 flex flex-col overflow-hidden min-h-0 mt-2',
            isCollapsed && 'hidden',
          )}
        >
          <div className="flex items-center justify-between px-2 pb-1.5 shrink-0 border-b border-border/50">
            <span className="text-xs font-bold text-foreground">
              {m.all_comments?.() || 'All comments'}
              {comments.length > 0 ? ` (${comments.length})` : ''}
            </span>
          </div>

          <ScrollArea className="flex-1 min-h-0 px-2 py-2 [&>div>div]:block!">
            {comments.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                {m.no_comments_yet?.() || 'No comments yet'}
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="space-y-2">
                    <MessageCard
                      teamId={teamId}
                      message={comment}
                      getUser={getUser}
                      onReply={setReplyingTo}
                      onViewAttachment={setViewingAttachment}
                      hasReplies={!!comment.replies?.length}
                      formatTimestamp={viewerDef?.commentsConfig?.formatTimestamp}
                      frameRate={
                        viewerDef?.commentsConfig?.hasTimestamp
                          ? file?.media?.metadata?.frameRate || 30
                          : undefined
                      }
                      startTimecode={
                        viewerDef?.commentsConfig?.hasTimestamp
                          ? file?.media?.metadata?.startTimecode
                          : undefined
                      }
                      isSelected={selectedCommentId === comment.id}
                      onSelect={() => {
                        onCommentSelect?.(comment)
                      }}
                    />
                    {comment.replies?.map((reply, index) => (
                      <div key={reply.id} className="pl-4 border-l border-border/60">
                        <MessageCard
                          teamId={teamId}
                          isReply={true}
                          message={reply}
                          getUser={getUser}
                          onReply={setReplyingTo}
                          onViewAttachment={setViewingAttachment}
                          hasReplies={false}
                          isLastReply={index === (comment.replies?.length ?? 0) - 1}
                          formatTimestamp={viewerDef?.commentsConfig?.formatTimestamp}
                          frameRate={
                            viewerDef?.commentsConfig?.hasTimestamp
                              ? file?.media?.metadata?.frameRate || 30
                              : undefined
                          }
                          startTimecode={
                            viewerDef?.commentsConfig?.hasTimestamp
                              ? file?.media?.metadata?.startTimecode
                              : undefined
                          }
                          isSelected={selectedCommentId === reply.id}
                          onSelect={() => {
                            onCommentSelect?.(reply)
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ))}
                <div ref={ref} />
              </div>
            )}
          </ScrollArea>

          {/* Sticky Bottom Comment Input Bar */}
          {(!readOnly || isPublic) && (
            <div className="mt-auto shrink-0 bg-background border-t border-border pt-1">
              <GuestIdentityPopup
                isOpen={isGuestPopupOpen}
                onClose={() => setIsGuestPopupOpen(false)}
                onSuccess={handleGuestSuccess}
              >
                <ChatInput
                  projectId={projectId}
                  onSendMessage={handleSendMessage}
                  replyingTo={replyingTo}
                  onCancelReply={() => setReplyingTo(null)}
                  hideAnnotationControl={hideAnnotationControl}
                  disableMentions={isPublic}
                  currentTime={viewerDef?.commentsConfig?.hasTimestamp ? currentTime : undefined}
                  formatTimestamp={viewerDef?.commentsConfig?.formatTimestamp}
                  frameRate={
                    viewerDef?.commentsConfig?.hasTimestamp
                      ? file?.media?.metadata?.frameRate || 30
                      : undefined
                  }
                  startTimecode={
                    viewerDef?.commentsConfig?.hasTimestamp
                      ? file?.media?.metadata?.startTimecode
                      : undefined
                  }
                  onTyping={onTyping}
                />
              </GuestIdentityPopup>
            </div>
          )}
        </TabsContent>

        {/* Fields Tab Content */}
        <TabsContent
          value="fields"
          className={cn(
            'flex-1 flex flex-col overflow-hidden min-h-0 mt-2',
            isCollapsed && 'hidden',
          )}
        >
          <ScrollArea className="flex-1 px-3 py-2 min-h-0 [&>div>div]:block!">
            {sortedFields && sortedFields.length > 0 ? (
              <div className="space-y-4 pb-6">
                {sortedFields.map((field) => (
                  <div key={field.id} className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {field.config?.name}
                    </label>
                    <div className="min-h-[32px]">
                      <FieldRenderer
                        fieldId={field.id}
                        config={field.config}
                        value={itemFieldValueMap[field.id!]?.value}
                        onSave={canEdit ? (val) => onSaveField(field.id!, val) : undefined}
                        readOnly={readOnly || field.readOnly || !canEdit}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No custom fields defined
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
