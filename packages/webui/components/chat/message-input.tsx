import type { CommentInfo, PostAttachmentRequest, PostAttachmentResponse } from '@shumai/dtos'
import type { BotInfo } from '@shumai/dtos'
import type { UserInfo } from '@shumai/dtos'
import { client } from '@/ui/api/client'
import { useAnnotationStore } from '@/ui/stores/annotation-store'
import type { Annotation } from '@/ui/types'
import { useMutation } from '@tanstack/react-query'
import { Skeleton } from '../ui/skeleton'
import { useMemberStore } from '@/ui/stores/members'
import { useTeamContextStore } from '@/ui/stores/team-context'
import {
  ArrowLeft,
  ArrowUp,
  Brush,
  ChevronDown,
  Clock,
  FileIcon,
  Minus,
  Paperclip,
  Redo,
  Square,
  Undo,
  XIcon,
} from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Button } from '../ui/button'
import { DrawAnnotation } from '../ui/icons'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { ProgressCircle } from '../ui/progress-circle'
import { formatTime, formatTimestamp, formatFrame } from '../viewers/utils'
import { Timecode } from '@shumai/timecode'

type UploadingFile = {
  id: string // A unique ID for the file, e.g., timestamp + name
  file: File
  progress: number
  attachmentId?: string
  error?: string
}

interface ChatInputProps {
  projectId: string
  onSendMessage: (
    text: string,
    attachmentIds: string[],
    annotations?: Annotation[],
    replyToId?: string | null,
    second?: number | null,
  ) => void
  replyingTo?: CommentInfo | null
  onCancelReply?: () => void
  bots?: BotInfo[]
  initialText?: string
  hideAnnotationControl?: boolean
  disableMentions?: boolean
  currentTime?: number
  frameRate?: number
  onTyping?: () => void
  timeMode?: 'standard' | 'frames' | 'timecode'
}

const PREDEFINED_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#000000', // Black
  '#ffffff', // White
]

type MentionEntity = { type: 'user'; data: UserInfo } | { type: 'bot'; data: BotInfo }

export const ChatInput = React.forwardRef<HTMLDivElement, ChatInputProps>(
  (
    {
      projectId,
      onSendMessage,
      replyingTo,
      onCancelReply,
      bots = [],
      initialText = '',
      hideAnnotationControl = false,
      disableMentions = false,
      currentTime,
      frameRate,
      onTyping,
      timeMode = 'standard',
    },
    ref,
  ) => {
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
    const [viewingFile, setViewingFile] = useState<File | null>(null)
    const [isTimestampEnabled, setIsTimestampEnabled] = useState(true)

    const { teamId, ensureTeamIdForProject } = useTeamContextStore()
    const { members: storeMembers, loading: membersLoading, fetchMembers } = useMemberStore()

    useEffect(() => {
      if (projectId && !teamId) {
        ensureTeamIdForProject(projectId)
      }
    }, [projectId, teamId, ensureTeamIdForProject])

    // Annotation Store
    const {
      isDrawing,
      setIsDrawing,
      currentTool,
      setTool,
      currentColor,
      setColor,
      undo,
      redo,
      history,
      historyIndex,
      annotations,
      reset: resetAnnotations,
    } = useAnnotationStore()

    const [showMentionList, setShowMentionList] = useState(false)
    const [mentionQuery, setMentionQuery] = useState('')
    const [highlightedIndex, setHighlightedIndex] = useState(0)
    const [collapsedSections, setCollapsedSections] = useState({ bots: false, users: false })
    const [hasContent, setHasContent] = useState(false)

    const editorRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const mentionRangeRef = useRef<Range | null>(null)

    const { mutateAsync: uploadAttachment } = useMutation({
      mutationFn: async ({
        projectId,
        data,
      }: {
        projectId: string
        data: PostAttachmentRequest
      }) => {
        const res = await client.api.projects[':projectId'].attachments.$post({
          param: { projectId: projectId },
          json: data,
        })
        if (!res.ok) throw new Error('Failed to create attachment')
        return (await res.json()) as PostAttachmentResponse
      },
    })

    useEffect(() => {
      if (initialText && editorRef.current) {
        editorRef.current.innerText = initialText
        setHasContent(!!initialText.trim())
        // Focus and move cursor to end
        editorRef.current.focus()
        const range = document.createRange()
        const sel = window.getSelection()
        range.selectNodeContents(editorRef.current)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }, [initialText])

    // Focus editor when replyingTo becomes truthy
    useEffect(() => {
      if (replyingTo && editorRef.current) {
        editorRef.current.focus()
        // Focus and move cursor to end
        const range = document.createRange()
        const sel = window.getSelection()
        range.selectNodeContents(editorRef.current)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }, [replyingTo])

    // Clean up drawing mode on unmount
    useEffect(() => {
      return () => {
        setIsDrawing(false)
      }
    }, [setIsDrawing])

    const filteredAgents = [
      ...storeMembers
        .filter(
          (u) => u.type === 'agent' && u.name?.toLowerCase().startsWith(mentionQuery.toLowerCase()),
        )
        .map((u) => ({ type: 'user' as const, data: u })),
      ...bots
        .filter((b) => b.name?.toLowerCase().startsWith(mentionQuery.toLowerCase()))
        .map((b) => ({ type: 'bot' as const, data: b })),
    ]

    const filteredHumans = storeMembers
      .filter(
        (u) => u.type !== 'agent' && u.name?.toLowerCase().startsWith(mentionQuery.toLowerCase()),
      )
      .map((u) => ({ type: 'user' as const, data: u }))

    const filteredEntities: MentionEntity[] = [
      ...(collapsedSections.bots ? [] : filteredAgents),
      ...(collapsedSections.users ? [] : filteredHumans),
    ]

    useEffect(() => {
      setHighlightedIndex(0)
    }, [mentionQuery, showMentionList, collapsedSections])

    const handleInput = () => {
      if (!editorRef.current) return
      setHasContent(!!editorRef.current.innerText.trim())
      onTyping?.()

      if (disableMentions) {
        setShowMentionList(false)
        mentionRangeRef.current = null
        return
      }

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

              if (teamId) {
                fetchMembers(teamId, true, true)
              }

              // Save the range for later insertion
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

      const mentionNode = document.createElement('span')
      mentionNode.contentEditable = 'false'
      mentionNode.dataset.type = 'mention'
      mentionNode.dataset.id = entity.data.id
      mentionNode.className =
        'inline-block bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded-md text-sm font-medium align-middle select-none mx-0.5'
      mentionNode.innerText = `@${entity.data.name}`

      range.insertNode(mentionNode)

      // Insert a space after the mention
      const spaceNode = document.createTextNode('\u00A0')
      mentionNode.after(spaceNode)

      // Move cursor after the space
      const newRange = document.createRange()
      const sel = window.getSelection()
      newRange.setStartAfter(spaceNode)
      newRange.collapse(true)
      sel?.removeAllRanges()
      sel?.addRange(newRange)

      setShowMentionList(false)
      mentionRangeRef.current = null
      setHasContent(true)
      editorRef.current.focus()
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
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    }

    const handleFileSelect = useCallback(
      async (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return
        const newFiles = Array.from(e.target.files)

        for (const file of newFiles) {
          const tempId = `${Date.now()}-${file.name}`
          const newUploadingFile: UploadingFile = {
            id: tempId,
            file,
            progress: 0,
          }
          setUploadingFiles((prev) => [...prev, newUploadingFile])

          try {
            const data: PostAttachmentResponse = await uploadAttachment({
              projectId,
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

    const removeFile = (id: string) => {
      setUploadingFiles((prev) => prev.filter((f) => f.id !== id))
    }

    const handleSend = () => {
      if (!editorRef.current) return
      const isUploading = uploadingFiles.some((f) => !f.attachmentId && !f.error)
      if (isUploading) return

      const successfulAttachmentIds = uploadingFiles
        .map((f) => f.attachmentId)
        .filter((id): id is string => !!id)

      // Serialize content
      let processedText = ''
      editorRef.current.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          processedText += node.textContent
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement
          if (el.dataset.type === 'mention') {
            processedText += `<@${el.dataset.id}>`
          } else if (el.tagName === 'BR') {
            processedText += '\n'
          } else if (el.tagName === 'DIV' || el.tagName === 'P') {
            // contentEditable often uses div/p for new lines
            processedText += '\n' + el.innerText
          } else {
            processedText += el.innerText
          }
        }
      })

      processedText = processedText.trim()

      // Allow sending if annotations exist, even if text is empty
      if (!processedText && successfulAttachmentIds.length === 0 && annotations.length === 0) return

      onSendMessage(
        processedText,
        successfulAttachmentIds,
        annotations,
        replyingTo?.id,
        isTimestampEnabled ? currentTime : undefined,
      )

      // Reset editor
      editorRef.current.innerHTML = ''
      setHasContent(false)
      setUploadingFiles([])
      setViewingFile(null)
      setIsDrawing(false)
      resetAnnotations()
      setShowMentionList(false)
      if (onCancelReply) onCancelReply()
    }

    const isUploading = uploadingFiles.some((f) => !f.attachmentId && !f.error)
    const hasSuccessfulUploads = uploadingFiles.some((f) => !!f.attachmentId)
    const canSend = hasContent || hasSuccessfulUploads || annotations.length > 0
    const showUpperPart = uploadingFiles.length > 0 || !!replyingTo

    return (
      <div
        ref={ref}
        className="relative flex flex-col w-full border border-foreground/35 rounded-3xl shadow-sm transition-all duration-200"
      >
        <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          cursor: text;
        }
      `}</style>
        {showMentionList &&
          (membersLoading || filteredAgents.length > 0 || filteredHumans.length > 0) && (
            <div className="absolute bottom-full left-4 mb-2 w-64 rounded-xl shadow-lg border border-border overflow-hidden z-20 bg-popover text-popover-foreground animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="h-64 overflow-y-auto">
                {membersLoading ? (
                  <div className="p-2 space-y-4 animate-pulse">
                    {/* Agents Skeleton */}
                    <div className="space-y-2">
                      <div className="px-3 py-1.5 bg-muted/50 border-b border-border">
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <Skeleton className="w-6 h-6 rounded-full" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <Skeleton className="w-6 h-6 rounded-full" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                    {/* Members Skeleton */}
                    <div className="space-y-2">
                      <div className="px-3 py-1.5 bg-muted/50 border-b border-border">
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <Skeleton className="w-6 h-6 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <Skeleton className="w-6 h-6 rounded-full" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {filteredAgents.length > 0 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setCollapsedSections((prev) => ({ ...prev, bots: !prev.bots }))
                          }}
                          className="w-full text-xs font-semibold text-muted-foreground px-3 py-2 bg-muted/50 border-b border-border sticky top-0 flex items-center justify-between hover:bg-muted transition-colors"
                        >
                          <span>Agents</span>
                          <ChevronDown
                            className={`w-3 h-3 transition-transform ${collapsedSections.bots ? '-rotate-90' : ''}`}
                          />
                        </button>
                        {!collapsedSections.bots &&
                          filteredAgents.map((item, index) => {
                            const actualIndex = index
                            return (
                              <button
                                key={item.data.id}
                                onClick={() => handleSelectEntity(item)}
                                onMouseEnter={() => setHighlightedIndex(actualIndex)}
                                className={`w-full flex items-center gap-2 px-3 py-2 transition-colors text-left ${
                                  actualIndex === highlightedIndex
                                    ? 'bg-accent text-accent-foreground'
                                    : 'hover:bg-accent/50'
                                }`}
                              >
                                <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-300">
                                  {item.data.name?.[0]}
                                </div>
                                <span className="text-sm">{item.data.name}</span>
                              </button>
                            )
                          })}
                      </>
                    )}

                    {filteredHumans.length > 0 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setCollapsedSections((prev) => ({ ...prev, users: !prev.users }))
                          }}
                          className="w-full text-xs font-semibold text-muted-foreground px-3 py-2 bg-muted/50 border-b border-border sticky top-0 flex items-center justify-between hover:bg-muted transition-colors"
                        >
                          <span>Members</span>
                          <ChevronDown
                            className={`w-3 h-3 transition-transform ${collapsedSections.users ? '-rotate-90' : ''}`}
                          />
                        </button>
                        {!collapsedSections.users &&
                          filteredHumans.map((item, index) => {
                            const actualIndex =
                              (collapsedSections.bots ? 0 : filteredAgents.length) + index
                            return (
                              <button
                                key={item.data.id}
                                onClick={() => handleSelectEntity(item)}
                                onMouseEnter={() => setHighlightedIndex(actualIndex)}
                                className={`w-full flex items-center gap-2 px-3 py-2 transition-colors text-left ${
                                  actualIndex === highlightedIndex
                                    ? 'bg-accent text-accent-foreground'
                                    : 'hover:bg-accent/50'
                                }`}
                              >
                                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-300">
                                  {item.data.name?.[0]}
                                </div>
                                <span className="text-sm">{item.data.name}</span>
                              </button>
                            )
                          })}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

        {showUpperPart && (
          <div className="flex flex-col gap-2 p-3 pb-0 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {replyingTo && (
              <div className="flex items-center justify-between bg-muted p-2 px-3 rounded-lg border border-border">
                <div className="text-xs text-muted-foreground truncate mr-2">
                  reply to: {replyingTo.message}
                </div>
                <button
                  onClick={onCancelReply}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted-foreground/10 shrink-0"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {uploadingFiles.length > 0 && (
              <div className="flex gap-3 overflow-x-auto py-2 px-1 scrollbar-hide">
                {uploadingFiles.map((upload) => (
                  <div key={upload.id} className="relative group flex-shrink-0">
                    <div className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                      {upload.file.type.startsWith('image/') ? (
                        <img
                          src={URL.createObjectURL(upload.file)}
                          alt="preview"
                          onClick={() => setViewingFile(upload.file)}
                          className={`w-full h-full object-cover ${
                            !upload.attachmentId ? 'opacity-50' : ''
                          }`}
                        />
                      ) : (
                        <FileIcon className="w-8 h-8 text-gray-400" />
                      )}
                      {isUploading && !upload.attachmentId && !upload.error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <ProgressCircle progress={upload.progress} className="w-10 h-10" />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeFile(upload.id)}
                      className="absolute -top-1.5 -right-1.5 bg-gray-500 text-white rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 z-10"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] text-gray-500 mt-1 block max-w-[4rem] truncate text-center">
                      {upload.file.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div
          onClick={() => editorRef.current?.focus()}
          className="w-full px-4 pt-1 pb-1 cursor-text flow-root max-h-60 overflow-y-auto"
        >
          {isTimestampEnabled && currentTime !== undefined && frameRate !== undefined && (
            <div
              onClick={(e) => {
                e.stopPropagation()
                editorRef.current?.focus()
              }}
              className="float-left select-none bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-2.5 py-0.5 mt-3 mr-2 rounded-sm text-xs font-mono font-bold flex items-center gap-1 cursor-text"
            >
              {(() => {
                if (timeMode === 'frames') {
                  return `${formatFrame(currentTime, frameRate)} fr`
                }
                if (timeMode === 'timecode') {
                  try {
                    return new Timecode(currentTime * frameRate, frameRate).toString()
                  } catch (e) {
                    console.error('Failed to create Timecode for message-input:', e)
                    return formatTimestamp(currentTime, frameRate)
                  }
                }
                return formatTime(currentTime)
              })()}
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            data-placeholder={replyingTo ? 'Reply...' : 'Message...'}
            className={`bg-transparent border-none focus:ring-0 resize-none min-h-[40px] leading-relaxed py-2 focus:outline-none block ${isTimestampEnabled && currentTime !== undefined && frameRate !== undefined && !hasContent ? 'pl-[120px]' : ''}`}
          />
        </div>

        <div className="flex justify-between items-center px-2 pb-2">
          {isDrawing ? (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide w-full mr-2">
              <Button
                onClick={() => {
                  setIsDrawing(false)
                  resetAnnotations() // Cancel drawing
                }}
                variant="ghost"
                size="icon"
                className="p-2 rounded-full cursor-pointer text-gray-500 hover:text-gray-700 hover:bg-gray-100 mr-2"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>

              <div className="h-4 w-px bg-gray-300 mx-1"></div>

              <button
                onClick={() => setTool('arrow')}
                className={`p-1.5 rounded hover:bg-gray-100 ${currentTool === 'arrow' ? 'text-blue-500 bg-blue-50' : 'text-gray-500'}`}
                title="Arrow"
              >
                <ArrowUp size={16} className="rotate-45" />
              </button>
              <button
                onClick={() => setTool('line')}
                className={`p-1.5 rounded hover:bg-gray-100 ${currentTool === 'line' ? 'text-blue-500 bg-blue-50' : 'text-gray-500'}`}
                title="Line"
              >
                <Minus size={16} className="-rotate-45" />
              </button>
              <button
                onClick={() => setTool('box')}
                className={`p-1.5 rounded hover:bg-gray-100 ${currentTool === 'box' ? 'text-blue-500 bg-blue-50' : 'text-gray-500'}`}
                title="Box"
              >
                <Square size={16} />
              </button>
              <button
                onClick={() => setTool('freehand')}
                className={`p-1.5 rounded hover:bg-gray-100 ${currentTool === 'freehand' ? 'text-blue-500 bg-blue-50' : 'text-gray-500'}`}
                title="Freehand"
              >
                <Brush size={16} />
              </button>

              <div className="h-4 w-px bg-gray-300 mx-1"></div>

              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1 p-1 rounded hover:bg-gray-100">
                    <div
                      className="w-4 h-4 rounded-full border border-gray-200"
                      style={{ backgroundColor: currentColor }}
                    />
                    <ChevronDown size={12} className="text-gray-500" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="center" side="top">
                  <div className="flex items-center gap-1">
                    {PREDEFINED_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-6 h-6 rounded-full border border-gray-200 transition-transform hover:scale-110 ${currentColor === c ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <div className="h-4 w-px bg-gray-300 mx-1"></div>

              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500"
              >
                <Undo size={16} />
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500"
              >
                <Redo size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                onChange={handleFileSelect}
              />
              {currentTime !== undefined && frameRate !== undefined && (
                <Button
                  onClick={() => setIsTimestampEnabled(!isTimestampEnabled)}
                  variant={isTimestampEnabled ? 'secondary' : 'ghost'}
                  size="icon"
                  className={`p-2 rounded-full cursor-pointer ${isTimestampEnabled ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  title={isTimestampEnabled ? 'Disable Timestamp' : 'Enable Timestamp'}
                >
                  <Clock className="w-4 h-4" />
                </Button>
              )}
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-full cursor-pointer"
                variant="ghost"
                size="icon"
                title="Attach files"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              {!hideAnnotationControl && (
                <Button
                  onClick={() => setIsDrawing(true)}
                  variant="ghost"
                  size="icon"
                  className="p-2 rounded-full cursor-pointer"
                  title="Toggle Annotation"
                >
                  <DrawAnnotation className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={!canSend || isUploading}
            className={`p-2 rounded-full transition-all duration-200 flex items-center justify-center shrink-0 ${
              canSend && !isUploading
                ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>

        {viewingFile && (
          <div
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setViewingFile(null)}
          >
            <button className="absolute top-4 right-4 text-white/70 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors z-50">
              <XIcon className="w-8 h-8" />
            </button>
            <div className="w-full h-full flex items-center justify-center p-2">
              <img
                src={URL.createObjectURL(viewingFile)}
                alt="Enlarged view"
                className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl cursor-zoom-out"
                onClick={(e) => {
                  e.stopPropagation()
                  setViewingFile(null)
                }}
              />
            </div>
            <div className="absolute bottom-6 text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
              {viewingFile.name}
            </div>
          </div>
        )}
      </div>
    )
  },
)
ChatInput.displayName = 'ChatInput'
