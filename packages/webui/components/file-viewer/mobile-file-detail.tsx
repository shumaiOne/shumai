import { client } from '@/ui/api/client'
import { FileViewer } from '@/ui/components/file-viewer'
import { AssetLinkedTasksDialog } from '@/ui/components/kanban/asset-linked-tasks-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/ui/alert-dialog'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Input } from '@/ui/components/ui/input'
import { usePermissions } from '@/ui/hooks/use-permissions'
import { selectFileNameWithoutExtension } from '@/ui/lib/rename-utils'
import { m } from '@/ui/paraglide/messages.js'
import { useMemberStore } from '@/ui/stores/members'
import type { Annotation } from '@/ui/types'
import type { AncestorFolder, AssetInfo, CommentInfo, FieldInfo } from '@shumai/dtos'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { MediaController } from '../viewers/types'
import { MobileFileBottomSheet } from './mobile-file-bottom-sheet'
import { MobileFileHeader } from './mobile-file-header'

export interface MobileFileDetailProps {
  projectId: string
  teamId?: string
  fileId: string
  file: AssetInfo
  projectInfo?: { name?: string; rootFolder?: string }
  ancestorFolders?: AncestorFolder[]
  parentFolderId?: string
  versions?: Array<{
    id: string
    version: number
    name?: string | null
    previewUrl?: string | null
  }>
  activeFileId: string
  startTime?: number
  isPublic?: boolean
  shareId?: string
  allowDownload?: boolean
  publicFields?: FieldInfo[]
  siblingFiles?: AssetInfo[]
  onNavigateToFile: (fileId: string) => void
  onNavigateBack: () => void
  onRenameFile?: (newName: string) => Promise<void>
  onDeleteFile?: () => Promise<void>
  onSaveField: (fieldId: string, value: unknown) => void
  onSelectVersion?: (versionId: string) => void
}

export function MobileFileDetail({
  projectId,
  teamId = '',
  fileId,
  file,
  projectInfo,
  ancestorFolders = [],
  versions,
  activeFileId,
  startTime,
  isPublic = false,
  shareId,
  allowDownload = true,
  publicFields,
  siblingFiles = [],
  onNavigateToFile,
  onNavigateBack,
  onRenameFile,
  onDeleteFile,
  onSaveField,
  onSelectVersion,
}: MobileFileDetailProps) {
  const { canEdit } = usePermissions(projectId)
  const { members } = useMemberStore()
  const mediaControllerRef = useRef<MediaController | null>(null)

  const [sheetHeightPercent, setSheetHeightPercent] = useState(50)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)

  // Dialogs
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [renameInput, setRenameInput] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isLinkedTasksOpen, setIsLinkedTasksOpen] = useState(false)

  // Linked tasks query for count
  const { data: linkedTasksData } = useQuery({
    queryKey: ['teams', teamId, 'kanban', 'assets', activeFileId, 'tasks'],
    queryFn: async () => {
      if (!teamId || !activeFileId || isPublic) return { data: [], total: 0 }
      const res = await client.api.teams[':teamId'].kanban.assets[':assetId'].tasks.$get({
        param: { teamId, assetId: activeFileId },
      })
      if (!res.ok) return { data: [], total: 0 }
      return (await res.json()) as { data: Array<{ id: string }>; total: number }
    },
    enabled: !!teamId && !!activeFileId && !isPublic,
  })
  const linkedTaskCount = linkedTasksData?.total ?? linkedTasksData?.data?.length ?? 0

  // Prev / Next file calculation
  const { prevFile, nextFile } = useMemo(() => {
    if (!siblingFiles || siblingFiles.length === 0) {
      return { prevFile: null, nextFile: null }
    }
    const currentIndex = siblingFiles.findIndex((f) => f.id === fileId || f.id === activeFileId)
    if (currentIndex === -1) {
      return { prevFile: null, nextFile: null }
    }
    return {
      prevFile: currentIndex > 0 ? siblingFiles[currentIndex - 1] : null,
      nextFile: currentIndex < siblingFiles.length - 1 ? siblingFiles[currentIndex + 1] : null,
    }
  }, [siblingFiles, fileId, activeFileId])

  const folderName =
    ancestorFolders.length > 0
      ? ancestorFolders[ancestorFolders.length - 1]?.name
      : projectInfo?.name

  const currentVersionObj = versions?.find((v) => v.id === activeFileId)
  const versionNumber =
    currentVersionObj?.version ?? (versions && versions.length > 0 ? versions.length : undefined)

  const downloadInfo = useMemo(() => {
    return {
      originalKey: file.media?.original?.key,
      videoTranscodes: file.media?.videoTranscodes?.map((t) => ({
        key: t.key,
        width: t.width,
        height: t.height,
      })),
    }
  }, [file.media])

  const handlePlay = () => {
    setAnnotations([])
    setSelectedCommentId(null)
  }

  const handleCommentSelect = (comment: CommentInfo) => {
    setSelectedCommentId(comment.id || null)
    const newAnnotations = comment.annotations as Annotation[]
    if (newAnnotations && newAnnotations.length > 0) {
      setAnnotations(newAnnotations)
    } else {
      setAnnotations([])
    }

    if (comment.second !== null && comment.second !== undefined) {
      mediaControllerRef.current?.seekTo(comment.second)
      mediaControllerRef.current?.pause()
    } else if (newAnnotations && newAnnotations.length > 0) {
      mediaControllerRef.current?.pause()
    }
  }

  const handleRenameSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!renameInput.trim() || !onRenameFile) return
    try {
      setIsRenaming(true)
      await onRenameFile(renameInput.trim())
      setIsRenameDialogOpen(false)
    } finally {
      setIsRenaming(false)
    }
  }

  const handleDeleteSubmit = async () => {
    if (!onDeleteFile) return
    try {
      setIsDeleting(true)
      await onDeleteFile()
      setIsDeleteDialogOpen(false)
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    setCurrentTime(0)
    setSelectedCommentId(null)
    setAnnotations([])
  }, [file?.id])

  return (
    <div className="flex h-screen w-full flex-col bg-background overflow-hidden relative">
      {/* Part 1: Mobile Header */}
      <MobileFileHeader
        fileName={file.name}
        folderName={folderName}
        version={versionNumber}
        versions={versions}
        activeFileId={activeFileId}
        isPublic={isPublic}
        shareId={shareId}
        allowDownload={allowDownload}
        downloadInfo={downloadInfo}
        canEdit={canEdit}
        onBack={onNavigateBack}
        hasPrevFile={!!prevFile}
        hasNextFile={!!nextFile}
        onPrevFile={() => prevFile && onNavigateToFile(prevFile.id!)}
        onNextFile={() => nextFile && onNavigateToFile(nextFile.id!)}
        onSelectVersion={onSelectVersion}
        onRename={() => {
          setRenameInput(file.name)
          setIsRenameDialogOpen(true)
        }}
        onDelete={() => setIsDeleteDialogOpen(true)}
        onLinkedTasks={!isPublic ? () => setIsLinkedTasksOpen(true) : undefined}
        linkedTaskCount={linkedTaskCount}
      />

      {/* Part 2: Media Viewer Content Area */}
      <div
        className="relative flex-1 flex flex-col min-h-0 bg-background overflow-hidden"
        style={{ paddingBottom: `${sheetHeightPercent}vh` }}
      >
        <FileViewer
          file={file}
          mediaControllerRef={mediaControllerRef}
          onPlay={handlePlay}
          onTimeUpdate={setCurrentTime}
          annotations={annotations}
          startTime={startTime}
          shareId={shareId}
          allowDownload={allowDownload}
        />
      </div>

      {/* Part 3: Freely Draggable Bottom Sheet */}
      <MobileFileBottomSheet
        teamId={teamId}
        projectId={projectId}
        file={file}
        onSaveField={onSaveField}
        members={members}
        onCommentSelect={handleCommentSelect}
        hideAnnotationControl={file.proxyType === 'audio'}
        readOnly={isPublic || !canEdit}
        publicFields={publicFields}
        isPublic={isPublic}
        shareId={shareId}
        currentTime={currentTime}
        onTyping={() => mediaControllerRef.current?.pause()}
        selectedCommentId={selectedCommentId}
        heightPercent={sheetHeightPercent}
        onHeightPercentChange={setSheetHeightPercent}
      />

      {/* Dialogs */}
      {!isPublic && isLinkedTasksOpen && (
        <AssetLinkedTasksDialog
          teamId={teamId}
          assetId={activeFileId}
          assetName={file.name}
          isOpen={isLinkedTasksOpen}
          onClose={() => setIsLinkedTasksOpen(false)}
        />
      )}

      {!isPublic && (
        <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
          <DialogContent>
            <form onSubmit={handleRenameSubmit}>
              <DialogHeader>
                <DialogTitle>{m.rename()}</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Input
                  ref={renameInputRef}
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  placeholder={m.enter_new_name?.() || 'Enter new name'}
                  onFocus={() => {
                    setTimeout(() => {
                      if (renameInputRef.current) {
                        selectFileNameWithoutExtension(renameInputRef.current)
                      }
                    }, 0)
                  }}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRenameDialogOpen(false)}
                >
                  {m.cancel()}
                </Button>
                <Button type="submit" disabled={isRenaming || !renameInput.trim()}>
                  {isRenaming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {m.save()}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {!isPublic && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{m.delete_asset_title?.() || 'Delete Asset?'}</AlertDialogTitle>
              <AlertDialogDescription>
                {m.delete_asset_description?.() ||
                  'Deleted items can be recovered for 30 days before being permanently deleted.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteSubmit}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {m.delete()}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
