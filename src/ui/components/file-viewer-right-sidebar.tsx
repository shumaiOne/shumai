import { type FieldInfo as MetadataFieldInfo } from '@/dtos/metadata'
import { client } from '@/ui/api/client'
import type { AssetInfo, AttachmentInfo, CommentInfo, FieldValueInfo } from '@/dtos/asset'
import type { UserInfo } from '@/dtos/team'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/ui/tabs'
import { useFieldStore } from '@/ui/stores/fields'
import { useInfiniteQuery, useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { MessageCard } from './chat/message-card'
import { ChatInput } from './chat/message-input'
import FieldRenderer from './field-renderer'
import { ScrollArea } from './ui/scroll-area'
import type { Annotation } from '@/ui/types'
import { GuestIdentityPopup } from './guest-identity-popup'

interface FileViewerRightSidebarProps {
  teamId: string
  projectId: string
  file: AssetInfo | null
  onSaveField: (fieldId: string, value: unknown) => void
  members: UserInfo[]
  onCommentSelect?: (comment: CommentInfo) => void
  hideAnnotationControl?: boolean
  readOnly?: boolean
  publicFields?: MetadataFieldInfo[]
  isPublic?: boolean
  shareId?: string
}

export function FileViewerRightSidebar({
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
}: FileViewerRightSidebarProps) {
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
  } | null>(null)

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

  const { data: bots } = useQuery({
    queryKey: ['projects', projectId, 'bots'],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].bots.$get({
        param: { projectId: projectId },
      })
      if (!res.ok) throw new Error('Failed to fetch bots')
      return await res.json()
    },
    enabled: !!projectId && !readOnly,
  })

  const isAiEnabled = file?.mediaType?.startsWith('image/') || file?.mediaType?.startsWith('video/')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enabledBots = isAiEnabled ? (bots as any[]) || [] : []

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
    }: {
      text: string
      attachmentIds: string[]
      annotations?: Annotation[]
      replyToId?: string | null
      guestUserId?: string
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

  React.useEffect(() => {
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
  ) => {
    if (!file?.id) return

    if (isPublic) {
      // Check if logged in
      console.log('[handleSendMessage] checking auth status')
      const meRes = await client.api.me.$get()
      const { id: loggedInUserId } = await meRes.json()
      console.log('[handleSendMessage] loggedInUserId:', loggedInUserId)

      if (!loggedInUserId) {
        const guestUserId = localStorage.getItem('guest_user_id')
        console.log('[handleSendMessage] guestUserId from storage:', guestUserId)
        if (!guestUserId) {
          console.log('[handleSendMessage] no guest ID, opening popup')
          setPendingComment({ text, attachmentIds, annotations, replyToId })
          setIsGuestPopupOpen(true)
          return
        }
        createComment({ text, attachmentIds, annotations, replyToId, guestUserId })
      } else {
        createComment({ text, attachmentIds, annotations, replyToId })
      }
    } else {
      createComment({ text, attachmentIds, annotations, replyToId })
    }
    setReplyingTo(null)
  }

  const handleGuestSuccess = (guestUserId: string) => {
    console.log('[handleGuestSuccess] guestUserId:', guestUserId)
    if (pendingComment) {
      createComment({ ...pendingComment, guestUserId })
      setPendingComment(null)
      setReplyingTo(null)
    }
  }

  const getUser = (id: string): UserInfo => {
    const member = members.find((m) => m.id === id)
    if (member) {
      return member
    }

    if (bots) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bot = (bots as any[]).find((b) => b.id === id)
      if (bot) {
        return { id: bot.id, name: bot.name, role: 'bot' }
      }
    }

    return {
      id: 'unknown',
      name: 'Unknown',
      role: 'unknown',
    }
  }

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center bg-background">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">No item selected</p>
          <p className="text-xs text-muted-foreground">
            Select a file to view its details and comments.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background h-full flex flex-col overflow-hidden">
      {/* Lightbox */}
      {viewingAttachment && viewingAttachment.mediaType?.startsWith('image/') && (
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
      <Tabs defaultValue="comments" className="p-4 flex-1 flex flex-col px-2 min-h-0">
        <TabsList className="w-full shrink-0">
          <TabsTrigger value="comments" className="flex-1">
            Comments
          </TabsTrigger>
          <TabsTrigger value="fields" className="flex-1">
            Fields
          </TabsTrigger>
        </TabsList>
        <TabsContent value="comments" className="flex-1 flex flex-col overflow-hidden min-h-0 mt-4">
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} onClick={() => onCommentSelect?.(comment)}>
                  <MessageCard
                    teamId={teamId}
                    message={comment}
                    getUser={getUser}
                    onReply={setReplyingTo}
                    onViewAttachment={setViewingAttachment}
                    hasReplies={!!comment.replies?.length}
                  />
                  {comment.replies?.map((reply, index) => (
                    <MessageCard
                      teamId={teamId}
                      isReply={true}
                      key={reply.id}
                      message={reply}
                      getUser={getUser}
                      onReply={setReplyingTo}
                      onViewAttachment={setViewingAttachment}
                      hasReplies={false}
                      isLastReply={index === (comment.replies?.length ?? 0) - 1}
                    />
                  ))}
                </div>
              ))}
              <div ref={ref} />
            </div>
          </ScrollArea>
          {(!readOnly || isPublic) && (
            <div className="mt-4 shrink-0">
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
                  users={members}
                  bots={enabledBots}
                  hideAnnotationControl={hideAnnotationControl}
                  disableMentions={isPublic}
                />
              </GuestIdentityPopup>
            </div>
          )}
        </TabsContent>
        <TabsContent value="fields" className="flex-1 flex flex-col overflow-hidden min-h-0 mt-4">
          <ScrollArea className="flex-1 px-4">
            {sortedFields && sortedFields.length > 0 && (
              <div className="space-y-4 pb-4">
                {sortedFields.map((field) => (
                  <div key={field.id} className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {field.config?.name}
                    </label>
                    <div className="min-h-[28px]">
                      <FieldRenderer
                        config={field.config}
                        value={itemFieldValueMap[field.id!]?.value}
                        onSave={(val) => onSaveField(field.id!, val)}
                        readOnly={readOnly}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
