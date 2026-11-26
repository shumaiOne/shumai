import React, { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  AttachmentInfo,
  CommentInfo,
  PostAttachmentRequest,
  PostAttachmentResponse,
  UserInfo,
} from '@shumai/dtos'
import { FileIcon, FileText, Paperclip, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { client } from '@/ui/api/client'
import { isImageFileName } from '@/ui/lib/media'
import { m } from '@/ui/paraglide/messages.js'
import { useMemberStore, type MemberInfo } from '@/ui/stores/members'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import { DrawAnnotation } from '../ui/icons'
import { ProgressCircle } from '../ui/progress-circle'
import { Skeleton } from '../ui/skeleton'
import { CommentVisibilitySelector } from './comment-visibility-selector'
import {
  createMentionNode,
  hydrateEditableWithMentions,
  serializeEditableContent,
} from './mention-utils'
import type { UploadingFile } from './message-input'

export interface MessageEditFormProps {
  projectId?: string
  teamId?: string
  message: CommentInfo
  parentIsInternal?: boolean
  getUser: (id: string) => MemberInfo | UserInfo
  displayTime: string
  hasDrawInfo: boolean
  onCancel: () => void
  onSaved: () => void
}

type MentionEntity = { type: 'user'; data: MemberInfo }

export const MessageEditForm: React.FC<MessageEditFormProps> = ({
  projectId,
  teamId: propTeamId,
  message,
  parentIsInternal = false,
  getUser,
  displayTime,
  hasDrawInfo,
  onCancel,
  onSaved,
}) => {
  const queryClient = useQueryClient()
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mentionRangeRef = useRef<Range | null>(null)
  const mentionListRef = useRef<HTMLDivElement>(null)

  const [editedIsInternal, setEditedIsInternal] = useState<boolean>(
    parentIsInternal ? true : Boolean(message.isInternal),
  )
  const [editedSecond, setEditedSecond] = useState<number | null>(message.second ?? null)
  const [keptAttachments, setKeptAttachments] = useState<AttachmentInfo[]>(
    () => message.attachments ?? [],
  )
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [hasText, setHasText] = useState<boolean>(() => Boolean((message.message ?? '').trim()))

  const [showMentionList, setShowMentionList] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const { teamId: storeTeamId, ensureTeamIdForProject } = useTeamContextStore()
  const effectiveTeamId = propTeamId || storeTeamId
  const {
    members: storeMembers,
    loading: membersLoading,
    fetchMembers,
    fetchProjectMembers,
  } = useMemberStore()

  useEffect(() => {
    if (projectId && !effectiveTeamId) {
      ensureTeamIdForProject(projectId)
    }
  }, [projectId, effectiveTeamId, ensureTeamIdForProject])

  // Hydrate editor once on mount so background comment polling never overwrites draft edits.
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const resolveUserName = (userId: string) => {
      const fromMentions = message.mentions?.find((u) => u.id === userId)
      if (fromMentions?.name) return fromMentions.name
      const fromStore = getUser(userId)
      return fromStore?.name || 'Unknown'
    }

    hydrateEditableWithMentions(editor, message.message ?? '', resolveUserName)
    setHasText(Boolean(serializeEditableContent(editor)))

    editor.focus()
    const range = document.createRange()
    const sel = window.getSelection()
    range.selectNodeContents(editor)
    range.collapse(false)
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [])

  const { mutateAsync: uploadAttachment } = useMutation({
    mutationFn: async ({
      targetProjectId,
      data,
    }: {
      targetProjectId: string
      data: PostAttachmentRequest
    }) => {
      const res = await client.api.projects[':projectId'].attachments.$post({
        param: { projectId: targetProjectId },
        json: data,
      })
      if (!res.ok) throw new Error('Failed to create attachment')
      return (await res.json()) as PostAttachmentResponse
    },
  })

  const { mutate: updateComment, isPending: isSaving } = useMutation({
    mutationFn: async (payload: {
      message: string
      isInternal: boolean
      second: number | null
      attachmentIds: string[]
    }) => {
      const res = await client.api.comments[':commentId'].$patch({
        param: { commentId: message.id },
        json: payload,
      })
      if (!res.ok) throw new Error('Failed to update comment')
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey.includes('comments'),
      })
      onSaved()
    },
    onError: () => {
      toast.error(m.failed_to_update_comment())
    },
  })

  const filteredEntities: MentionEntity[] = storeMembers
    .filter((u) => u.name?.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    .map((u) => ({ type: 'user' as const, data: u }))

  useEffect(() => {
    setHighlightedIndex(0)
  }, [mentionQuery, showMentionList])

  useEffect(() => {
    mentionListRef.current
      ?.querySelector<HTMLElement>(`[data-index="${highlightedIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex])

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()

  const handleInput = () => {
    if (!editorRef.current) return
    setHasText(Boolean(serializeEditableContent(editorRef.current)))

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    const range = sel.getRangeAt(0)
    const node = range.startContainer
    const offset = range.startOffset

    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent || ''
      const textBeforeCursor = textContent.slice(0, offset)
      const lastAtPos = textBeforeCursor.lastIndexOf('@')

      if (lastAtPos !== -1) {
        const isStartOfLine = lastAtPos === 0
        const charBeforeAt = textBeforeCursor[lastAtPos - 1]
        const hasSpaceBefore = isStartOfLine || /\s/.test(charBeforeAt)

        if (hasSpaceBefore) {
          const query = textBeforeCursor.slice(lastAtPos + 1)
          if (!/\s/.test(query)) {
            setMentionQuery(query)
            setShowMentionList(true)

            if (projectId) {
              fetchProjectMembers(projectId, true, true)
            } else if (effectiveTeamId) {
              fetchMembers(effectiveTeamId, true, true)
            }

            const mentionRange = document.createRange()
            mentionRange.setStart(node, lastAtPos)
            mentionRange.setEnd(node, offset)
            mentionRangeRef.current = mentionRange
            return
          }
        }
      }
    }
    setShowMentionList(false)
    mentionRangeRef.current = null
  }

  const handleSelectEntity = (entity: MentionEntity) => {
    if (!mentionRangeRef.current || !editorRef.current) return

    const range = mentionRangeRef.current
    range.deleteContents()

    const mentionNode = createMentionNode({ id: entity.data.id, name: entity.data.name })
    range.insertNode(mentionNode)

    const spaceNode = document.createTextNode('\u00A0')
    mentionNode.after(spaceNode)

    const newRange = document.createRange()
    const sel = window.getSelection()
    newRange.setStartAfter(spaceNode)
    newRange.collapse(true)
    sel?.removeAllRanges()
    sel?.addRange(newRange)

    setShowMentionList(false)
    mentionRangeRef.current = null
    setHasText(true)
    editorRef.current.focus()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (!text) return

    const success =
      typeof document.execCommand === 'function' &&
      document.queryCommandSupported?.('insertText') &&
      document.execCommand('insertText', false, text)

    if (!success) {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        range.deleteContents()
        const textNode = document.createTextNode(text)
        range.insertNode(textNode)
        range.setStartAfter(textNode)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      } else if (editorRef.current) {
        editorRef.current.innerText += text
      }
    }

    handleInput()
  }

  const handleFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || !projectId) return
      const newFiles = Array.from(e.target.files)

      for (const file of newFiles) {
        const tempId = `${Date.now()}-${Math.random()}-${file.name}`
        setUploadingFiles((prev) => [...prev, { id: tempId, file, progress: 0 }])

        try {
          const data = await uploadAttachment({
            targetProjectId: projectId,
            data: {
              fileName: file.name,
              contentType: file.type,
              size: file.size,
            },
          })

          if (data.uploadUrl && data.id) {
            await fetch(data.uploadUrl, {
              method: 'PUT',
              body: file,
              headers: {
                'Content-Type': file.type,
              },
            })

            setUploadingFiles((prev) =>
              prev.map((uf) =>
                uf.id === tempId ? { ...uf, progress: 100, attachmentId: data.id } : uf,
              ),
            )
          }
        } catch (error) {
          setUploadingFiles((prev) =>
            prev.map((uf) =>
              uf.id === tempId
                ? {
                    ...uf,
                    error: error instanceof Error ? error.message : 'Upload failed',
                  }
                : uf,
            ),
          )
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [projectId, uploadAttachment],
  )

  const isUploading = uploadingFiles.some((f) => !f.attachmentId && !f.error)
  const uploadedAttachmentIds = uploadingFiles
    .map((f) => f.attachmentId)
    .filter((id): id is string => Boolean(id))

  const effectiveIsInternal = parentIsInternal ? true : editedIsInternal
  const canSave =
    !isSaving &&
    !isUploading &&
    (hasText || keptAttachments.length > 0 || uploadedAttachmentIds.length > 0 || hasDrawInfo)

  const handleSave = () => {
    if (!editorRef.current || !canSave) return
    const serialized = serializeEditableContent(editorRef.current)
    const attachmentIds = [...keptAttachments.map((att) => att.assetId), ...uploadedAttachmentIds]

    if (!serialized && attachmentIds.length === 0 && !hasDrawInfo) return

    updateComment({
      message: serialized,
      isInternal: effectiveIsInternal,
      second: editedSecond,
      attachmentIds,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing) return

    if (showMentionList && filteredEntities.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredEntities.length - 1))
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < filteredEntities.length - 1 ? prev + 1 : 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        handleSelectEntity(filteredEntities[highlightedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowMentionList(false)
        return
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div
      className="relative mt-1.5 flex flex-col gap-2"
      data-testid="comment-edit-form"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Mention dropdown */}
      {showMentionList && (membersLoading || filteredEntities.length > 0) && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute bottom-full left-0 mb-2 w-60 rounded-xl shadow-lg border border-border overflow-hidden z-30 bg-popover text-popover-foreground"
        >
          <div ref={mentionListRef} className="max-h-48 overflow-y-auto">
            {membersLoading ? (
              <div className="p-2 space-y-2 animate-pulse">
                <div className="flex items-center gap-2 px-2 py-1">
                  <Skeleton className="w-6 h-6 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            ) : (
              filteredEntities.map((item, index) => (
                <button
                  type="button"
                  key={item.data.id}
                  data-index={index}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectEntity(item)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full flex items-center gap-2 px-3 py-2 transition-colors text-left cursor-pointer ${
                    index === highlightedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50'
                  }`}
                >
                  <Avatar className="w-6 h-6">
                    {item.data.image && (
                      <AvatarImage
                        src={item.data.image}
                        alt={item.data.name}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="text-[10px] bg-purple-400 text-black font-semibold">
                      {getInitials(item.data.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm truncate">{item.data.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Timestamp & Draw badges */}
      {((editedSecond !== null && displayTime) || hasDrawInfo) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {editedSecond !== null && displayTime && (
            <div
              data-testid="edit-comment-timestamp"
              className="inline-flex items-center gap-1 select-none bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 pl-2 pr-1 py-0.5 rounded-sm text-xs leading-none font-mono font-bold"
            >
              <span>{displayTime}</span>
              <button
                type="button"
                onClick={() => setEditedSecond(null)}
                className="p-0.5 rounded hover:bg-blue-200/70 dark:hover:bg-blue-800/70 cursor-pointer"
                title={m.remove_timestamp()}
                aria-label={m.remove_timestamp()}
                data-testid="edit-comment-remove-timestamp"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          )}
          {hasDrawInfo && (
            <div
              className="inline-flex items-center bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-1 py-0.5 rounded-sm text-xs leading-none font-bold"
              title={m.contains_drawing_annotations()}
            >
              <DrawAnnotation className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      )}

      {/* Editable text box */}
      <div
        ref={editorRef}
        contentEditable={!isSaving}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-testid="edit-comment-input"
        className="w-full min-h-[56px] max-h-48 overflow-y-auto rounded-lg border border-border bg-background px-2.5 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring whitespace-pre-wrap break-words"
      />

      {/* Existing & Newly Uploaded Attachments */}
      {(keptAttachments.length > 0 || uploadingFiles.length > 0) && (
        <div className="flex flex-col gap-1.5 w-full max-w-full overflow-hidden">
          {keptAttachments.map((att) => {
            const rawName = att.url?.split('/').pop()?.split('?')[0] || 'file'
            const name = decodeURIComponent(rawName)
            const isImage = isImageFileName(name)
            return (
              <div
                key={att.id}
                data-testid="edit-existing-attachment"
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5"
              >
                {isImage ? (
                  <img
                    src={att.url}
                    alt={name}
                    className="w-8 h-8 rounded object-cover shrink-0 bg-muted/40"
                  />
                ) : (
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-xs font-medium text-foreground truncate flex-1 min-w-0">
                  {name}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setKeptAttachments((prev) => prev.filter((item) => item.id !== att.id))
                  }
                  className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-muted transition-colors cursor-pointer shrink-0"
                  aria-label={`${m.delete()} ${name}`}
                  data-testid={`edit-remove-attachment-${att.assetId}`}
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}

          {uploadingFiles.map((upload) => (
            <div
              key={upload.id}
              data-testid="edit-new-attachment"
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5"
            >
              {upload.file.type.startsWith('image/') ? (
                <div className="relative w-8 h-8 rounded overflow-hidden shrink-0 bg-muted/40">
                  <img
                    src={URL.createObjectURL(upload.file)}
                    alt={upload.file.name}
                    className={`w-full h-full object-cover ${!upload.attachmentId ? 'opacity-50' : ''}`}
                  />
                  {!upload.attachmentId && !upload.error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <ProgressCircle progress={upload.progress} className="w-5 h-5" />
                    </div>
                  )}
                </div>
              ) : (
                <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-foreground truncate block">
                  {upload.file.name}
                </span>
                {upload.error && (
                  <span className="text-[10px] text-destructive block truncate">
                    {upload.error}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  setUploadingFiles((prev) => prev.filter((item) => item.id !== upload.id))
                }
                className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-muted transition-colors cursor-pointer shrink-0"
                aria-label={`${m.delete()} ${upload.file.name}`}
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action bar: attach + visibility on left, cancel + save on right */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          {projectId && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                onChange={handleFileSelect}
                data-testid="edit-comment-file-input"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-7 w-7 rounded-full cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                title={m.attach_files()}
                aria-label={m.attach_files()}
              >
                <Paperclip className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          <CommentVisibilitySelector
            isInternal={effectiveIsInternal}
            onChange={setEditedIsInternal}
            disabled={parentIsInternal}
            disabledTooltip={m.internal_reply_locked_tooltip()}
            align="start"
            side="bottom"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={isSaving}
            onClick={onCancel}
            className="cursor-pointer"
          >
            {m.cancel()}
          </Button>
          <Button
            type="button"
            size="xs"
            disabled={!canSave}
            onClick={handleSave}
            className="cursor-pointer"
            data-testid="edit-comment-save"
          >
            {m.save()}
          </Button>
        </div>
      </div>
    </div>
  )
}
