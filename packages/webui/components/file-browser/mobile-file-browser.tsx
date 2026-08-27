'use client'

import { client } from '@/ui/api/client'
import { usePermissions } from '@/ui/hooks/use-permissions'
import { m } from '@/ui/paraglide/messages.js'
import { useUploadStore } from '@/ui/stores/upload'
import type { AssetInfo, CreateUploadTaskRequest } from '@shumai/dtos'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InferRequestType, InferResponseType } from 'hono/client'
import { formatSize } from '@/ui/lib/format'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  FolderClock,
  FolderPlus,
  Loader2,
  Plus,
  Upload,
} from 'lucide-react'
import React, { useRef, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { toast } from 'sonner'
import { ulid } from 'ulid'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Input } from '../ui/input'
import { FileCard } from './file-card'
import { FolderCard } from './folder-card'
import { useFileActions } from './use-file-actions'

export interface MobileFileBrowserProps {
  teamId: string
  projectId: string
  assetId: string
  folders: AssetInfo[]
  files: AssetInfo[]
  totalFolders?: number
  totalFiles?: number
  totalFoldersSize?: number
  totalFilesSize?: number
  selectedItem: AssetInfo | null
  selectedIds: Set<string>
  onItemSelect: (item: AssetInfo, event: React.MouseEvent) => void
  onItemDoubleClick: (item: AssetInfo) => void
  onSaveField?: (fileId: string, fieldId: string, value: unknown) => void
  onClearSelection: () => void
  fetchNextFoldersPage: () => void
  hasNextFoldersPage: boolean
  isFetchingNextFoldersPage: boolean
  fetchNextFilesPage: () => void
  hasNextFilesPage: boolean
  isFetchingNextFilesPage: boolean
  isRecentlyDeleted?: boolean
  isRecents?: boolean
  isShareView?: boolean
  isPublic?: boolean
  shareId?: string
  allowDownload?: boolean
  rootFolderId?: string
}

type FileWithId = {
  file: File
  id: string
}

let pendingFilesToUpload: FileWithId[] = []

export function MobileFileBrowser({
  teamId,
  projectId,
  assetId,
  folders,
  files,
  totalFolders,
  totalFiles,
  totalFoldersSize,
  totalFilesSize,
  selectedItem,
  selectedIds,
  onItemSelect,
  onItemDoubleClick,
  onSaveField,
  onClearSelection,
  fetchNextFoldersPage,
  hasNextFoldersPage,
  isFetchingNextFoldersPage,
  fetchNextFilesPage,
  hasNextFilesPage,
  isFetchingNextFilesPage,
  isRecentlyDeleted = false,
  isRecents = false,
  isShareView = false,
  isPublic = false,
  shareId,
  allowDownload = true,
}: MobileFileBrowserProps) {
  const queryClient = useQueryClient()
  const { canEdit, canAdmin } = usePermissions(projectId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const [foldersExpanded, setFoldersExpanded] = useState(true)
  const [filesExpanded, setFilesExpanded] = useState(true)
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [isEmptyTrashDialogOpen, setIsEmptyTrashDialogOpen] = useState(false)

  const foldersCount = totalFolders ?? folders.length
  const filesCount = totalFiles ?? files.length
  const foldersSizeVal =
    totalFoldersSize ??
    (folders.length > 0 ? folders.reduce((acc, f) => acc + (f.sizeByte || 0), 0) : -1)
  const filesSizeVal =
    totalFilesSize ?? (files.length > 0 ? files.reduce((acc, f) => acc + (f.sizeByte || 0), 0) : -1)
  const showFoldersSize = foldersSizeVal > -1
  const showFilesSize = filesSizeVal > -1

  const formatCount = (count: number, isFile: boolean) => {
    if (isFile) {
      return count === 1 ? m.n_assets_singular({ count }) : m.n_assets_plural({ count })
    } else {
      return count === 1 ? m.n_folders_singular({ count }) : m.n_folders_plural({ count })
    }
  }

  const {
    editingItemId,
    setEditingItemId,
    handleAction,
    onRenameSubmit,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    confirmDelete,
    isDownloadDialogOpen,
    setIsDownloadDialogOpen,
    isLoadingLinks,
    resolvedFiles,
    startDownload,
  } = useFileActions({
    teamId,
    projectId,
    assetId,
    folders,
    files,
    selectedIds,
    isPublic,
    shareId,
  })

  // Infinite scroll trigger
  const { ref: loadMoreRef, inView } = useInView()
  React.useEffect(() => {
    if (inView) {
      if (hasNextFoldersPage && !isFetchingNextFoldersPage) {
        fetchNextFoldersPage()
      } else if (hasNextFilesPage && !isFetchingNextFilesPage) {
        fetchNextFilesPage()
      }
    }
  }, [
    inView,
    hasNextFoldersPage,
    isFetchingNextFoldersPage,
    hasNextFilesPage,
    isFetchingNextFilesPage,
    fetchNextFoldersPage,
    fetchNextFilesPage,
  ])

  // Upload actions
  const incrementUploading = useUploadStore((state) => state.increment)
  const decrementUploading = useUploadStore((state) => state.decrement)
  const startTask = useUploadStore((state) => state.startTask)
  const updateFileProgress = useUploadStore((state) => state.updateFileProgress)
  const failFile = useUploadStore((state) => state.failFile)

  const $confirmUpload = client.api.teams[':teamId'].upload.tasks[':taskId'].$patch
  const { mutateAsync: confirmUpload } = useMutation<
    InferResponseType<typeof $confirmUpload>,
    Error,
    InferRequestType<typeof $confirmUpload>
  >({
    mutationFn: async (request) => {
      const res = await $confirmUpload(request)
      if (!res.ok) throw new Error('Failed to confirm upload')
      return (await res.json()) as InferResponseType<typeof $confirmUpload>
    },
  })

  const uploadFiles = async (
    filesList: FileWithId[],
    presignedUrls: { id?: string; url?: string; fileId?: string }[],
    taskId: string,
  ) => {
    const uploadUrlMap = presignedUrls?.reduce(
      (
        acc: Record<string, { url: string; fileId: string }>,
        item: { id?: string; url?: string; fileId?: string },
      ) => {
        if (item.id) {
          acc[item.id] = {
            url: item.url || '',
            fileId: item.fileId || '',
          }
        }
        return acc
      },
      {},
    )
    if (!uploadUrlMap) return

    const concurrencyLimit = 5
    const queue = [...filesList]

    const uploadNext = async () => {
      while (queue.length > 0) {
        const item = queue.shift()
        if (item) {
          const uploadInfo = uploadUrlMap[item.id]
          if (uploadInfo && uploadInfo.url) {
            incrementUploading()
            try {
              const xhr = new XMLHttpRequest()
              const uploadPromise = new Promise<{ ok: boolean; status: number }>(
                (resolve, reject) => {
                  xhr.open('PUT', uploadInfo.url)
                  xhr.setRequestHeader('Content-Type', item.file.type)

                  xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                      updateFileProgress(taskId, uploadInfo.fileId, event.loaded)
                    }
                  }

                  xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                      resolve({ ok: true, status: xhr.status })
                    } else {
                      resolve({ ok: false, status: xhr.status })
                    }
                  }

                  xhr.onerror = () => reject(new Error('Network error'))
                  xhr.onabort = () => reject(new Error('Upload aborted'))
                  xhr.send(item.file)
                },
              )

              const resp = await uploadPromise
              if (!resp.ok) {
                failFile(taskId, uploadInfo.fileId)
                toast.error(`Failed to upload file: ${item.file.name}`)
              }
            } catch (error) {
              failFile(taskId, uploadInfo.fileId)
              toast.error(`Failed to upload file: ${item.file.name}`)
              await confirmUpload({
                param: { teamId: teamId!, taskId: taskId },
                json: {
                  fileId: uploadInfo.fileId,
                  errorMessage: `upload failed with error: ${error instanceof Error ? error.message : String(error)}`,
                },
              })
            } finally {
              decrementUploading()
              queryClient.invalidateQueries({
                queryKey: ['search', teamId, assetId],
              })
            }
          }
        }
      }
    }

    const activeUploaders = Array(concurrencyLimit)
      .fill(null)
      .map(() => uploadNext())
    await Promise.all(activeUploaders)
  }

  const $createUploadTask = client.api.teams[':teamId'].upload.tasks.$post
  const { mutate: createUploadTaskMutation } = useMutation<
    InferResponseType<typeof $createUploadTask>,
    Error,
    InferRequestType<typeof $createUploadTask>,
    { files: FileWithId[] }
  >({
    mutationFn: async (request) => {
      const res = await $createUploadTask(request)
      if (!res.ok) throw new Error('Failed to create upload task')
      return (await res.json()) as InferResponseType<typeof $createUploadTask>
    },
    onMutate: () => {
      return { files: [...pendingFilesToUpload] }
    },
    onSuccess: async (data, _variables, context) => {
      const currentFiles = context?.files || []
      const filesProgressInfo = currentFiles
        .map((f) => {
          const urlInfo = (
            data.presignedUrls as { id?: string; url?: string; fileId?: string }[] | undefined
          )?.find((p) => p.id === f.id)
          return {
            fileId: urlInfo?.fileId || f.id,
            name: f.file.name,
            size: f.file.size,
          }
        })
        .filter((info) => !!info.fileId)

      const visibleFiles = currentFiles.filter((f) => !f.file.name.startsWith('.'))
      const taskName =
        visibleFiles.length === 1 ? visibleFiles[0].file.name : `${visibleFiles.length} Items`

      if (data.taskId) {
        startTask(data.taskId, taskName, filesProgressInfo)
      }

      queryClient.invalidateQueries({ queryKey: ['search', teamId, assetId] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'upload', 'tasks'] })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await uploadFiles(currentFiles, data.presignedUrls as any, data.taskId!)
      queryClient.invalidateQueries({ queryKey: ['search', teamId, assetId] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'upload', 'tasks'] })
    },
  })

  const processAndUploadFiles = (selectedFiles: FileList | File[]) => {
    if (!selectedFiles || selectedFiles.length === 0) return

    const fileWithIds: FileWithId[] = []
    const root: CreateUploadTaskRequest['files'] = []
    const directories = new Map<string, CreateUploadTaskRequest['files']>()

    for (const file of selectedFiles) {
      const path = (file.webkitRelativePath || file.name).split('/')
      if (path.some((part) => part.startsWith('.'))) {
        continue
      }
      const fileName = path.pop()!
      let currentLevel = root
      let currentPath = ''
      for (const dir of path) {
        currentPath = `${currentPath}/${dir}`
        if (!directories.has(currentPath)) {
          const newDir: CreateUploadTaskRequest['files'] = []
          const parentDir = {
            name: dir,
            type: 'folder' as const,
            id: ulid(),
            children: newDir,
            size: 0,
          }
          currentLevel.push(parentDir)
          directories.set(currentPath, newDir)
          currentLevel = newDir
        } else {
          currentLevel = directories.get(currentPath)!
        }
      }
      const fileWithId = { file, id: ulid() }
      fileWithIds.push(fileWithId)
      let mediaType = file.type
      if (fileName.toLowerCase().endsWith('.wma') && mediaType?.startsWith('video/')) {
        mediaType = mediaType.replace(/^video\//, 'audio/')
      }
      currentLevel.push({
        name: fileName,
        size: file.size,
        type: 'file',
        id: fileWithId.id,
        children: [],
        mediaType,
      })
    }
    pendingFilesToUpload = fileWithIds
    createUploadTaskMutation({
      param: { teamId: teamId },
      json: {
        parentId: assetId,
        files: root,
      },
    })
  }

  const $createFolder = client.api.folders.$post
  const { mutate: createFolderMutation, isPending: isCreatingFolder } = useMutation({
    mutationFn: async (name: string) => {
      const res = await $createFolder({
        json: { name, parentId: assetId },
      })
      if (!res.ok) throw new Error('Failed to create folder')
      return await res.json()
    },
    onSuccess: () => {
      toast.success(m.new_folder())
      setIsNewFolderDialogOpen(false)
      setNewFolderName('')
      queryClient.invalidateQueries({ queryKey: ['search', teamId, assetId] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`)
    },
  })

  const { mutate: emptyTrash, isPending: isEmptyingTrash } = useMutation({
    mutationFn: async () => {
      const res = await client.api.projects[':projectId']['empty-trash'].$post({
        param: { projectId },
      })
      if (!res.ok) throw new Error('Failed to empty trash')
      return await res.json()
    },
    onSuccess: () => {
      toast.success(m.trash_emptied_successfully())
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'recently-deleted'],
      })
      onClearSelection()
      setIsEmptyTrashDialogOpen(false)
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`)
    },
  })

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return
    createFolderMutation(newFolderName.trim())
  }

  const isFolderEmpty =
    folders.length === 0 &&
    files.length === 0 &&
    !isFetchingNextFoldersPage &&
    !isFetchingNextFilesPage

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden relative">
      {/* Hidden file inputs for upload actions */}
      {canEdit && (
        <>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) processAndUploadFiles(e.target.files)
            }}
          />
          <input
            type="file"
            ref={folderInputRef}
            multiple
            /* @ts-expect-error - webkitdirectory is not in standard input type */
            webkitdirectory="true"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) processAndUploadFiles(e.target.files)
            }}
          />
        </>
      )}

      {/* Recently Deleted banner */}
      {isRecentlyDeleted && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-b border-border text-sm shrink-0">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-xs">{m.recently_deleted_notice()}</span>
          </div>
          {canAdmin && (
            <Button
              variant="destructive"
              size="sm"
              disabled={isEmptyingTrash || (folders.length === 0 && files.length === 0)}
              onClick={() => setIsEmptyTrashDialogOpen(true)}
              className="h-7 px-2.5 text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-destructive-foreground"
            >
              Delete
            </Button>
          )}
        </div>
      )}

      {/* Main scroll area */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 pb-24">
        <div className="max-w-lg mx-auto w-full">
          {/* Folders Section */}
          {foldersCount > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setFoldersExpanded(!foldersExpanded)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3 font-medium select-none cursor-pointer"
              >
                {foldersExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span>
                  {formatCount(foldersCount, false)}
                  {showFoldersSize ? ` • ${formatSize(foldersSizeVal)}` : ''}
                </span>
              </button>

              {foldersExpanded && (
                <div className="grid grid-cols-1 gap-4 w-full">
                  {folders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      item={folder}
                      isSelected={selectedItem?.id === folder.id}
                      isChecked={selectedIds.has(folder.id!)}
                      isEditing={editingItemId === folder.id}
                      onSelect={onItemSelect}
                      onDoubleClick={onItemDoubleClick}
                      onContextMenu={() => {}}
                      onDragStart={() => {}}
                      onDrop={() => {}}
                      onRename={(newName) => onRenameSubmit(folder, newName)}
                      onFinishEditing={() => setEditingItemId(null)}
                      onAction={(action, item) =>
                        handleAction(action as 'rename' | 'delete' | 'download' | 'restore', item)
                      }
                      isRecentlyDeleted={isRecentlyDeleted}
                      isRecents={isRecents}
                      selectedCount={selectedIds.size}
                      canEdit={canEdit}
                      isShareView={isShareView}
                      allowDownload={allowDownload}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Files Section */}
          {filesCount > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setFilesExpanded(!filesExpanded)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3 font-medium select-none cursor-pointer"
              >
                {filesExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span>
                  {formatCount(filesCount, true)}
                  {showFilesSize ? ` • ${formatSize(filesSizeVal)}` : ''}
                </span>
              </button>

              {filesExpanded && (
                <div className="grid grid-cols-1 gap-4 w-full">
                  {files.map((file) => (
                    <FileCard
                      key={file.id}
                      teamId={teamId}
                      item={file}
                      isSelected={selectedItem?.id === file.id}
                      isChecked={selectedIds.has(file.id!)}
                      isEditing={editingItemId === file.id}
                      onSelect={onItemSelect}
                      onDoubleClick={onItemDoubleClick}
                      onContextMenu={() => {}}
                      onDragStart={() => {}}
                      onDrop={() => {}}
                      onRename={(newName) => onRenameSubmit(file, newName)}
                      onFinishEditing={() => setEditingItemId(null)}
                      onSaveField={(fieldId, value) => onSaveField?.(file.id!, fieldId, value)}
                      fields={[]}
                      onAction={(action, item) =>
                        handleAction(action as 'rename' | 'delete' | 'download' | 'restore', item)
                      }
                      isRecentlyDeleted={isRecentlyDeleted}
                      isRecents={isRecents}
                      selectedCount={selectedIds.size}
                      canEdit={canEdit}
                      isShareView={isShareView}
                      allowDownload={allowDownload}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Empty state */}
        {isFolderEmpty && (
          <div className="flex flex-col items-center justify-center h-64 text-sm text-muted-foreground p-6 text-center">
            {isRecents ? (
              <div className="flex flex-col items-center gap-2">
                <FolderClock className="h-10 w-10 text-muted-foreground/40 mb-1" />
                <p className="font-medium text-foreground">{m.no_recent_files()}</p>
                <p className="text-xs text-muted-foreground">{m.no_recent_files_description()}</p>
              </div>
            ) : (
              <span>{m.this_folder_is_empty()}</span>
            )}
          </div>
        )}

        {/* Infinite scroll loader / trigger */}
        <div ref={loadMoreRef} className="py-4 flex justify-center items-center min-h-6">
          {(isFetchingNextFoldersPage || isFetchingNextFilesPage) && (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Floating Action Button (+) for users with edit permissions */}
      {canEdit && !isRecentlyDeleted && !isRecents && !isShareView && !isPublic && (
        <div className="fixed bottom-6 right-6 z-30">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 flex items-center justify-center transition-all active:scale-95"
                aria-label="Actions"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-48 mb-2">
              <DropdownMenuItem
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2.5 py-2 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>{m.upload_file()}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => folderInputRef.current?.click()}
                className="flex items-center gap-2.5 py-2 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>{m.upload_folder()}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setIsNewFolderDialogOpen(true)}
                className="flex items-center gap-2.5 py-2 cursor-pointer"
              >
                <FolderPlus className="h-4 w-4" />
                <span>{m.new_folder()}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateFolderSubmit}>
            <DialogHeader>
              <DialogTitle>{m.new_folder()}</DialogTitle>
              <DialogDescription>{m.folder_name()}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                autoFocus
                placeholder={m.folder_name()}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewFolderDialogOpen(false)}
              >
                {m.cancel()}
              </Button>
              <Button type="submit" disabled={!newFolderName.trim() || isCreatingFolder}>
                {isCreatingFolder ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {m.confirm()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.delete_asset_title()}</AlertDialogTitle>
            <AlertDialogDescription>{m.delete_asset_description()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {m.delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty Trash Confirmation Alert Dialog */}
      <AlertDialog open={isEmptyTrashDialogOpen} onOpenChange={setIsEmptyTrashDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.empty_trash_title()}</AlertDialogTitle>
            <AlertDialogDescription>{m.empty_trash_description()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => emptyTrash()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isEmptyingTrash}
            >
              {isEmptyingTrash ? 'Deleting...' : m.delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Download Dialog */}
      <Dialog open={isDownloadDialogOpen} onOpenChange={setIsDownloadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isLoadingLinks ? m.preparing_download() : m.confirm_download()}
            </DialogTitle>
            <DialogDescription>
              {isLoadingLinks ? m.resolving_files_wait() : m.folder_files_download_description()}
            </DialogDescription>
          </DialogHeader>

          {isLoadingLinks ? (
            <div className="space-y-4 py-6 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm font-medium text-muted-foreground mt-2">
                {m.preparing_download_links()}
              </span>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="text-sm text-muted-foreground">
                {m.download_includes_files({ count: resolvedFiles.length })}
              </div>
              <div className="flex items-start gap-3 p-3 text-sm rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/30">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{m.no_folder_structure()}</p>
                  <p className="mt-0.5 text-xs text-amber-700/90 dark:text-amber-400/90">
                    {m.folder_structure_warning()}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {!isLoadingLinks ? (
              <>
                <Button variant="outline" onClick={() => setIsDownloadDialogOpen(false)}>
                  {m.cancel()}
                </Button>
                <Button
                  onClick={startDownload}
                  className="gap-2"
                  disabled={resolvedFiles.length === 0}
                >
                  <Download className="h-4 w-4" />
                  {m.start_download()}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsDownloadDialogOpen(false)}>
                {m.cancel()}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
