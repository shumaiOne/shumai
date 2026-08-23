import React, { useState, useRef, useEffect } from 'react'
import { Paperclip, ArrowUp, X, Loader2, FileText, Image as ImageIcon } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import { toast } from 'sonner'
import { Button } from '@/ui/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import { formatSize } from '@/ui/lib/format'
import { useMemberStore, type MemberInfo } from '@/ui/stores/members'
import type {
  KanbanAttachmentPayload,
  PostAttachmentRequest,
  PostKanbanAttachmentResponse,
} from '@shumai/dtos'

interface UploadingFile {
  id: string
  file: File
  isUploading: boolean
  payload?: KanbanAttachmentPayload
  error?: string
}

interface TaskCommentInputProps {
  teamId: string
  onSendMessage: (text: string, attachments?: KanbanAttachmentPayload[]) => Promise<void> | void
  isSubmitting?: boolean
}

export function TaskCommentInput({ teamId, onSendMessage, isSubmitting }: TaskCommentInputProps) {
  const [text, setText] = useState('')
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [showMentionList, setShowMentionList] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mentionListRef = useRef<HTMLDivElement>(null)

  const { members, fetchMembers } = useMemberStore()

  useEffect(() => {
    if (teamId) {
      fetchMembers(teamId, true, true)
    }
  }, [teamId, fetchMembers])

  const { mutateAsync: getUploadUrl } = useMutation({
    mutationFn: async (data: PostAttachmentRequest) => {
      const res = await client.api.teams[':teamId'].kanban.attachments.$post({
        param: { teamId },
        json: data,
      })
      if (!res.ok) throw new Error('Failed to get attachment upload url')
      return (await res.json()) as PostKanbanAttachmentResponse
    },
  })

  // Auto-resize textarea
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }

    // Mention detection
    const cursorPos = e.target.selectionStart || 0
    const textBeforeCursor = val.slice(0, cursorPos)
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
          return
        }
      }
    }

    setShowMentionList(false)
  }

  const filteredMembers = members.filter((m) =>
    m.name?.toLowerCase().includes(mentionQuery.toLowerCase()),
  )

  useEffect(() => {
    setHighlightedIndex(0)
  }, [mentionQuery, showMentionList])

  const handleSelectMention = (member: MemberInfo) => {
    if (!textareaRef.current) return
    const cursorPos = textareaRef.current.selectionStart || 0
    const textBeforeCursor = text.slice(0, cursorPos)
    const textAfterCursor = text.slice(cursorPos)
    const lastAtPos = textBeforeCursor.lastIndexOf('@')

    if (lastAtPos !== -1) {
      const newText = `${text.slice(0, lastAtPos)}@${member.name} ${textAfterCursor}`
      setText(newText)
      setShowMentionList(false)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          const newCursorPos = lastAtPos + member.name.length + 2
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
        }
      }, 0)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const newUploading: UploadingFile[] = files.map((file) => ({
      id: `${Date.now()}-${file.name}-${Math.random()}`,
      file,
      isUploading: true,
    }))

    setUploadingFiles((prev) => [...prev, ...newUploading])

    for (const uf of newUploading) {
      try {
        const res = await getUploadUrl({
          fileName: uf.file.name,
          size: uf.file.size,
          contentType: uf.file.type || 'application/octet-stream',
        })

        // Direct upload to S3
        const uploadRes = await fetch(res.uploadUrl, {
          method: 'PUT',
          body: uf.file,
          headers: {
            'Content-Type': uf.file.type || 'application/octet-stream',
          },
        })

        if (!uploadRes.ok) {
          throw new Error('Failed to upload file to storage')
        }

        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.id === uf.id
              ? {
                  ...item,
                  isUploading: false,
                  payload: {
                    id: res.id,
                    name: res.name,
                    key: res.key,
                    sizeByte: res.sizeByte,
                    contentType: res.contentType,
                    proxyType: res.proxyType,
                  },
                }
              : item,
          ),
        )
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        toast.error(`${uf.file.name}: ${message}`)
        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.id === uf.id ? { ...item, isUploading: false, error: message } : item,
          ),
        )
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (id: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const isUploadingAny = uploadingFiles.some((f) => f.isUploading)
  const successfulAttachments = uploadingFiles
    .map((f) => f.payload)
    .filter((p): p is KanbanAttachmentPayload => !!p)

  const canSend = (text.trim().length > 0 || successfulAttachments.length > 0) && !isUploadingAny

  const handleSend = async () => {
    if (!canSend || isSubmitting) return

    try {
      await onSendMessage(
        text.trim(),
        successfulAttachments.length > 0 ? successfulAttachments : undefined,
      )
      setText('')
      setUploadingFiles([])
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch {
      // Error handled by parent
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionList && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev + 1) % filteredMembers.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const selected = filteredMembers[highlightedIndex]
        if (selected) handleSelectMention(selected)
        return
      }
      if (e.key === 'Escape') {
        setShowMentionList(false)
        return
      }
    }

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="relative flex flex-col w-full border border-border focus-within:border-foreground/40 bg-card rounded-2xl p-2.5 shadow-2xs transition-all">
      {/* Mention Popup */}
      {showMentionList && filteredMembers.length > 0 && (
        <div
          ref={mentionListRef}
          className="absolute bottom-full left-0 mb-2 w-64 max-h-48 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg z-50"
        >
          {filteredMembers.map((member, idx) => (
            <button
              key={member.id}
              type="button"
              onClick={() => handleSelectMention(member)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                idx === highlightedIndex
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'hover:bg-muted text-foreground'
              }`}
            >
              <Avatar className="w-5 h-5">
                {member.image && <AvatarImage src={member.image} />}
                <AvatarFallback className="text-[9px]">
                  {member.name?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{member.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Uploading / Attached Files Preview */}
      {uploadingFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-2 mb-1.5 border-b border-border/50">
          {uploadingFiles.map((uf) => {
            const isImage = uf.file.type.startsWith('image/')
            return (
              <div
                key={uf.id}
                className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg bg-muted/60 border border-border text-xs max-w-[200px]"
              >
                {uf.isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                ) : isImage ? (
                  <ImageIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0 flex-1 truncate">
                  <span className="truncate block font-medium text-[11px]">{uf.file.name}</span>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    {formatSize(uf.file.size)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(uf.id)}
                  className="p-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Text Area */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={m.comment_placeholder()}
        rows={1}
        className="w-full min-h-[44px] max-h-[160px] bg-transparent border-0 focus:outline-hidden focus-visible:ring-0 resize-none text-xs text-foreground placeholder:text-muted-foreground/70 p-1 font-sans leading-relaxed"
      />

      {/* Footer Controls: Attachment Button + Send Button */}
      <div className="flex items-center justify-between pt-1 mt-1 border-t border-border/40">
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => fileInputRef.current?.click()}
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Attach files"
            disabled={isSubmitting}
          >
            <Paperclip className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground/60 hidden sm:inline pl-1">
            Cmd+Enter to send
          </span>
        </div>

        <Button
          type="button"
          size="icon-xs"
          onClick={handleSend}
          disabled={!canSend || isSubmitting}
          className="h-7 w-7 rounded-full shadow-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all shrink-0"
          title="Send comment"
        >
          {isSubmitting || isUploadingAny ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
          )}
        </Button>
      </div>
    </div>
  )
}
