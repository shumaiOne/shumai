import { Avatar, AvatarFallback, AvatarImage } from '@/ui/components/ui/avatar'
import { Button } from '@/ui/components/ui/button'
import { DrawAnnotation, ShumaiLogo } from '@/ui/components/ui/icons'
import { getViewerForFile } from '@/ui/components/viewers/registry'
import { formatFrame, formatTimecode } from '@/ui/components/viewers/video/utils'
import { isImageFileName } from '@/ui/lib/media'
import { m } from '@/ui/paraglide/messages.js'
import { useUiStore } from '@/ui/stores/ui'
import type { AssetInfo, CommentInfo } from '@shumai/dtos'
import {
  ArrowDownWideNarrow,
  CheckCircle2,
  FileAudio,
  FileIcon,
  FileText,
  Loader2,
  Lock,
  Printer,
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { parseAnnotations } from './annotation-overlay-svg'
import { CommentFrameThumbnail } from './comment-frame-thumbnail'
import {
  fitHeaderThumbnailBox,
  HEADER_MAX_HEIGHT,
  resolveAssetDisplayDimensions,
  type Dimensions,
} from './sizing'

export type PrintSortMode = 'position' | 'oldest' | 'newest'

export interface PrintCommentsViewProps {
  asset: AssetInfo
  breadcrumbs: string[]
  comments: CommentInfo[]
  shareId?: string
  sharePassword?: string
}

function getHeaderThumbnailUrl(asset: AssetInfo): string | null {
  if (asset.preview?.thumbnailUrl) return asset.preview.thumbnailUrl
  if (asset.media?.imageTranscodes && asset.media.imageTranscodes.length > 0) {
    const sorted = [...asset.media.imageTranscodes]
      .filter((t) => Boolean(t.url))
      .sort((a, b) => (a.width || 0) - (b.width || 0))
    if (sorted[0]?.url) return sorted[0].url
  }
  return null
}

function getImageCommentThumbnailUrl(asset: AssetInfo): string | null {
  if (asset.media?.imageTranscodes && asset.media.imageTranscodes.length > 0) {
    const valid = asset.media.imageTranscodes.filter((t) => Boolean(t.url))
    const adequate = valid
      .filter((t) => (t.width || 0) >= 400)
      .sort((a, b) => (a.width || 0) - (b.width || 0))
    if (adequate[0]?.url) return adequate[0].url
    const largest = [...valid].sort((a, b) => (b.width || 0) - (a.width || 0))
    if (largest[0]?.url) return largest[0].url
  }
  return asset.preview?.thumbnailUrl || null
}

function buildFrameEndpointUrl(params: {
  assetId: string
  second: number
  width?: number
  shareId?: string
  sharePassword?: string
}): string {
  const qs = new URLSearchParams({
    second: String(params.second),
    width: String(params.width ?? 400),
  })
  if (params.shareId) {
    if (params.sharePassword) {
      qs.set('p', params.sharePassword)
    }
    return `/api/shares/${encodeURIComponent(params.shareId)}/files/${encodeURIComponent(params.assetId)}/comments/frame?${qs.toString()}`
  }
  return `/api/files/${encodeURIComponent(params.assetId)}/comments/frame?${qs.toString()}`
}

function formatShortDate(iso?: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  }).format(date)
}

function formatCommentDateTime(iso?: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const datePart = new Intl.DateTimeFormat(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  }).format(date)
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
  return `${datePart} · ${timePart}`
}

function splitMiddleTruncate(name: string): { head: string; tail: string } {
  if (name.length <= 16) return { head: name, tail: '' }
  const tailLen = 10
  return {
    head: name.slice(0, name.length - tailLen),
    tail: name.slice(name.length - tailLen),
  }
}

function preprocessMarkdown(text: string): string {
  return text.replace(/<@([a-zA-Z0-9_-]+)>/g, '@$1').replace(/^\[([^\]]+)\]:/gm, '\\[$1\\]:')
}

function renderPlainCommentText(comment: CommentInfo): React.ReactNode {
  const text = comment.message ?? ''
  const parts = text.split(/(<@[a-zA-Z0-9_-]+>)/g)
  return parts.map((part, index) => {
    if (part.match(/^<@[a-zA-Z0-9_-]+>$/)) {
      const userId = part.slice(2, -1)
      const mentionedUser = comment.mentions?.find((u) => u.id === userId)
      return (
        <span key={index} className="font-medium text-primary">
          @{mentionedUser?.name || 'Unknown'}
        </span>
      )
    }
    return <React.Fragment key={index}>{part}</React.Fragment>
  })
}

interface HeaderThumbnailProps {
  url: string | null
  proxyType: string | null
  initialDimensions: Dimensions | null
}

const HeaderThumbnail: React.FC<HeaderThumbnailProps> = ({ url, proxyType, initialDimensions }) => {
  const [naturalSize, setNaturalSize] = useState<Dimensions | null>(initialDimensions)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setNaturalSize(initialDimensions)
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
    }
  }, [url, initialDimensions])

  if (!url) {
    return (
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-muted/40"
        style={{ width: HEADER_MAX_HEIGHT, height: HEADER_MAX_HEIGHT }}
        data-testid="print-header-thumbnail"
      >
        {proxyType === 'audio' ? (
          <FileAudio className="h-5 w-5 text-muted-foreground" />
        ) : proxyType === 'pdf' ? (
          <FileText className="h-5 w-5 text-muted-foreground" />
        ) : (
          <FileIcon className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
    )
  }

  const { width, height } = fitHeaderThumbnailBox(naturalSize)

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border transparency-checkerboard"
      style={{ width, height }}
      data-testid="print-header-thumbnail"
    >
      <img
        ref={imgRef}
        src={url}
        alt=""
        onLoad={(e) => {
          const img = e.currentTarget
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
          }
        }}
        className="block h-full w-full"
      />
    </div>
  )
}

export const PrintCommentsView: React.FC<PrintCommentsViewProps> = ({
  asset,
  breadcrumbs,
  comments,
  shareId,
  sharePassword,
}) => {
  const { videoTimeDisplayMode } = useUiStore()
  const viewerDef = useMemo(() => getViewerForFile(asset), [asset])
  const proxyType = asset.proxyType ?? asset.media?.proxyType ?? null

  const hasPositionSort = Boolean(viewerDef.commentsConfig?.hasTimestamp)
  const [sortMode, setSortMode] = useState<PrintSortMode>(hasPositionSort ? 'position' : 'oldest')
  const [settledFrameUrls, setSettledFrameUrls] = useState<Record<string, string>>({})

  const frameRate = viewerDef.commentsConfig?.hasTimestamp
    ? asset.media?.metadata?.frameRate || 30
    : undefined
  const startTimecode = viewerDef.commentsConfig?.hasTimestamp
    ? asset.media?.metadata?.startTimecode
    : undefined

  const formatCommentTimestamp = useCallback(
    (second: number | null | undefined): string => {
      if (second === null || second === undefined) return ''
      if (viewerDef.commentsConfig?.formatTimestamp) {
        return viewerDef.commentsConfig.formatTimestamp(second)
      }
      if (!frameRate) return ''
      const frameIndex = formatFrame(second, frameRate)
      return formatTimecode(frameIndex, frameRate, videoTimeDisplayMode, startTimecode)
    },
    [viewerDef, frameRate, videoTimeDisplayMode, startTimecode],
  )

  const sortedComments = useMemo(() => {
    const list = [...comments]
    if (sortMode === 'position') {
      list.sort((a, b) => {
        const aHas = a.second !== null && a.second !== undefined
        const bHas = b.second !== null && b.second !== undefined
        if (aHas && bHas) {
          if (a.second! !== b.second!) return a.second! - b.second!
          return a.id.localeCompare(b.id)
        }
        if (aHas) return -1
        if (bHas) return 1
        return a.id.localeCompare(b.id)
      })
    } else if (sortMode === 'newest') {
      list.sort((a, b) => b.id.localeCompare(a.id))
    } else {
      list.sort((a, b) => a.id.localeCompare(b.id))
    }
    return list
  }, [comments, sortMode])

  const hasVisualThumbnailColumn =
    proxyType === 'video' || proxyType === '3d' || proxyType === 'pdf' || proxyType === 'image'

  const getCommentFrameUrl = useCallback(
    (comment: CommentInfo): string | null => {
      if (!hasVisualThumbnailColumn) return null
      if (proxyType === 'image') {
        return getImageCommentThumbnailUrl(asset)
      }
      if (proxyType === 'video' || proxyType === '3d' || proxyType === 'pdf') {
        if (comment.second !== null && comment.second !== undefined) {
          return buildFrameEndpointUrl({
            assetId: asset.id,
            second: comment.second,
            width: 400,
            shareId,
            sharePassword,
          })
        }
        // If an untimestamped comment still carries visual annotations, show the asset poster/thumbnail
        const anns = parseAnnotations(comment.annotations)
        if (anns.length > 0) {
          return getHeaderThumbnailUrl(asset)
        }
        return null
      }
      return null
    },
    [hasVisualThumbnailColumn, proxyType, asset, shareId, sharePassword],
  )

  const frameUrls = useMemo(() => {
    const urls = new Map<string, string>()
    for (const comment of comments) {
      const url = getCommentFrameUrl(comment)
      if (url) urls.set(comment.id, url)

      for (const reply of comment.replies ?? []) {
        if (parseAnnotations(reply.annotations).length === 0) continue
        const replyUrl = getCommentFrameUrl(reply)
        if (replyUrl) urls.set(reply.id, replyUrl)
      }
    }
    return urls
  }, [comments, getCommentFrameUrl])

  const settledFrameCount = Array.from(frameUrls).filter(
    ([id, url]) => settledFrameUrls[id] === url,
  ).length
  const isLoadingFrames = settledFrameCount < frameUrls.size

  const sortIndicatorLabel = useMemo(() => {
    if (sortMode === 'oldest') return m.print_comments_sorted_by_oldest()
    if (sortMode === 'newest') return m.print_comments_sorted_by_newest()
    if (proxyType === 'pdf') return m.print_comments_sorted_by_page()
    if (proxyType === '3d') return m.print_comments_sorted_by_angle()
    return m.print_comments_sorted_by_timecode()
  }, [sortMode, proxyType])

  const positionSortOptionLabel = useMemo(() => {
    if (proxyType === 'pdf') return m.print_comments_sort_page()
    if (proxyType === '3d') return m.print_comments_sort_angle()
    return m.print_comments_sort_timecode()
  }, [proxyType])

  const headerThumbUrl = useMemo(() => getHeaderThumbnailUrl(asset), [asset])
  const assetDimensions = useMemo(() => resolveAssetDisplayDimensions(asset), [asset])
  const { head: nameHead, tail: nameTail } = splitMiddleTruncate(asset.name || '')
  const creatorAndDate = [asset.creator?.name, formatShortDate(asset.createdAt)]
    .filter(Boolean)
    .join(', ')

  const commentCountLabel =
    comments.length === 1
      ? m.print_comments_count_one()
      : m.print_comments_count({ count: String(comments.length) })

  const renderFrame = (commentId: string, annotations: ReturnType<typeof parseAnnotations>) => {
    const url = frameUrls.get(commentId)
    if (!url) return null

    return (
      <CommentFrameThumbnail
        key={url}
        src={url}
        annotations={annotations}
        initialDimensions={assetDimensions}
        onStatusChange={() =>
          setSettledFrameUrls((prev) =>
            prev[commentId] === url ? prev : { ...prev, [commentId]: url },
          )
        }
      />
    )
  }

  const renderCommentEntry = (
    comment: CommentInfo,
    options: {
      indexNumber?: number
      isReply: boolean
      hasReplies: boolean
      isLastReply: boolean
    },
  ) => {
    const timestamp = formatCommentTimestamp(comment.second)
    const annotations = parseAnnotations(comment.annotations)
    const hasAnnotations = annotations.length > 0
    const creatorName = comment.creator?.name || 'Unknown'

    return (
      <div
        key={comment.id}
        className={`relative flex gap-2.5 ${options.isReply ? 'pt-3' : ''}`}
        data-testid={options.isReply ? 'print-reply-item' : 'print-comment-item'}
      >
        {/* Avatar + vertical thread connector matching Frame.io / Shumai threads */}
        <div className="relative flex w-6 shrink-0 flex-col items-center">
          {options.isReply && (
            <div className="absolute -top-3 left-1/2 h-3.5 w-px -translate-x-1/2 bg-border" />
          )}
          {((options.hasReplies && !options.isReply) ||
            (options.isReply && !options.isLastReply)) && (
            <div className="absolute top-6 bottom-[-12px] left-1/2 w-px -translate-x-1/2 bg-border" />
          )}
          <Avatar className="relative z-10 h-6 w-6">
            {comment.creator?.image && (
              <AvatarImage src={comment.creator.image} alt={creatorName} className="object-cover" />
            )}
            <AvatarFallback className="bg-muted text-[10px] font-semibold text-foreground">
              {creatorName[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Entry content */}
        <div className="min-w-0 flex-1">
          {/* Author + timestamp + #index + completed status */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">{creatorName}</span>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {formatCommentDateTime(comment.createdAt)}
              </span>
              {comment.isInternal && (
                <span
                  className="inline-flex items-center text-muted-foreground"
                  title={m.internal_comment_tooltip()}
                  aria-label={m.internal_comment_tooltip()}
                  data-testid="print-comment-internal"
                >
                  <Lock className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {comment.isCompleted && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                  data-testid="print-comment-completed"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{m.print_comments_completed()}</span>
                </span>
              )}
              {options.indexNumber !== undefined && (
                <span className="text-xs font-medium text-muted-foreground">
                  <span className="opacity-70">#</span>
                  {options.indexNumber}
                </span>
              )}
            </div>
          </div>

          {/* Prefix (timecode / page / angle + annotation indicator) + Comment text */}
          <div className="mt-1 text-sm leading-relaxed text-foreground">
            {(timestamp || hasAnnotations) && (
              <span className="mr-2 inline-flex items-center gap-1.5 align-middle">
                {timestamp && (
                  <span
                    className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold leading-none text-foreground"
                    data-testid="print-comment-timestamp"
                  >
                    {timestamp}
                  </span>
                )}
                {hasAnnotations && (
                  <span
                    className="inline-flex items-center text-muted-foreground"
                    title={m.print_comments_has_annotations()}
                    aria-label={m.print_comments_has_annotations()}
                  >
                    <DrawAnnotation className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>
            )}

            {comment.sessionId && comment.message ? (
              <div className="prose prose-sm mt-0.5 max-w-none break-words text-foreground">
                <Markdown>{preprocessMarkdown(comment.message)}</Markdown>
              </div>
            ) : (
              <span className="whitespace-pre-wrap break-words">
                {renderPlainCommentText(comment)}
              </span>
            )}
          </div>

          {options.isReply && frameUrls.has(comment.id) && (
            <div className="mt-2">{renderFrame(comment.id, annotations)}</div>
          )}

          {/* Attachments */}
          {comment.attachments && comment.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2" data-testid="print-comment-attachments">
              {comment.attachments.map((att) => {
                const rawName = att.url?.split('/').pop()?.split('?')[0] || 'file'
                const name = decodeURIComponent(rawName)
                const isImage = isImageFileName(name)
                return (
                  <div
                    key={att.id}
                    className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-card px-2 py-1"
                  >
                    {isImage ? (
                      <img
                        src={att.url}
                        alt={name}
                        className="h-10 w-10 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="max-w-[220px] truncate text-xs font-medium text-foreground">
                      {name}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Emoji reactions */}
          {comment.reactionCounts && comment.reactionCounts.length > 0 && (
            <div
              className="mt-2 flex flex-wrap items-center gap-1.5"
              data-testid="print-comment-reactions"
            >
              {comment.reactionCounts.map((reaction) => (
                <span
                  key={reaction.code}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-foreground"
                >
                  <span className="leading-none">{reaction.code}</span>
                  <span className="font-semibold">{reaction.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="print-sheet min-h-screen bg-background text-foreground">
      {/* Non-printable action toolbar */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm print:hidden">
        <div className="mx-auto flex max-w-[860px] flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isLoadingFrames ? (
              <span
                className="inline-flex items-center gap-2 font-medium text-foreground"
                data-testid="print-frames-progress"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>
                  {m.print_comments_loading_frames({
                    loaded: String(settledFrameCount),
                    total: String(frameUrls.size),
                  })}
                </span>
              </span>
            ) : (
              <span>{commentCountLabel}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5 text-xs">
              {hasPositionSort && (
                <button
                  type="button"
                  onClick={() => setSortMode('position')}
                  className={`rounded px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                    sortMode === 'position'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {positionSortOptionLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSortMode('oldest')}
                className={`rounded px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                  sortMode === 'oldest'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m.print_comments_sort_oldest()}
              </button>
              <button
                type="button"
                onClick={() => setSortMode('newest')}
                className={`rounded px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                  sortMode === 'newest'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m.print_comments_sort_newest()}
              </button>
            </div>

            <Button
              type="button"
              size="sm"
              disabled={isLoadingFrames}
              onClick={() => window.print()}
              className="gap-1.5 cursor-pointer"
              data-testid="print-comments-button"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{m.print()}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Printable document body */}
      <div className="mx-auto max-w-[860px] px-6 py-8 print:max-w-none print:px-0 print:py-0">
        {/* Document Header */}
        <header className="flex items-center gap-4 pb-5">
          <HeaderThumbnail
            url={headerThumbUrl}
            proxyType={proxyType}
            initialDimensions={assetDimensions}
          />

          <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
            {/* Top row: Breadcrumbs + Shumai Logo */}
            <div className="flex items-center justify-between gap-4">
              <nav
                aria-label="Breadcrumb"
                className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
              >
                {breadcrumbs.map((segment, i) => (
                  <React.Fragment key={`${segment}-${i}`}>
                    {i > 0 && <span className="shrink-0 opacity-60">/</span>}
                    <span className="truncate">{segment}</span>
                  </React.Fragment>
                ))}
              </nav>
              <ShumaiLogo className="h-4 w-4 shrink-0 text-foreground" aria-label="Shumai" />
            </div>

            {/* Bottom row: Filename + Creator & Date */}
            <div className="flex items-baseline justify-between gap-4">
              <h1
                className="flex min-w-0 text-base font-semibold leading-tight text-foreground"
                title={asset.name}
              >
                <span className="truncate">{nameHead}</span>
                {nameTail && <span className="shrink-0">{nameTail}</span>}
              </h1>
              {creatorAndDate && (
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                  {creatorAndDate}
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="border-b border-border" />

        {/* Sort Indicator */}
        <div className="flex items-center gap-1.5 py-4 text-xs font-medium text-muted-foreground">
          <ArrowDownWideNarrow className="h-4 w-4" />
          <span>{sortIndicatorLabel}</span>
        </div>

        {/* Comments List */}
        {sortedComments.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {m.print_comments_empty()}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sortedComments.map((comment, idx) => {
              const annotations = parseAnnotations(comment.annotations)
              const replies = comment.replies ?? []

              return (
                <article
                  key={comment.id}
                  className="flex gap-5 py-5 break-inside-avoid"
                  data-testid="print-comment-thread"
                >
                  {hasVisualThumbnailColumn && (
                    <div className="w-[200px] shrink-0">{renderFrame(comment.id, annotations)}</div>
                  )}

                  <div className="min-w-0 flex-1">
                    {renderCommentEntry(comment, {
                      indexNumber: idx + 1,
                      isReply: false,
                      hasReplies: replies.length > 0,
                      isLastReply: false,
                    })}
                    {replies.map((reply, replyIdx) =>
                      renderCommentEntry(reply, {
                        isReply: true,
                        hasReplies: false,
                        isLastReply: replyIdx === replies.length - 1,
                      }),
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
