'use client'
import { client } from '@/ui/api/client'
import type { InferRequestType, InferResponseType } from 'hono/client'
import { m } from '@/ui/src/paraglide/messages.js'

import { usePermissions } from '@/ui/hooks/use-permissions'
import { getAllFilesFromEntries } from '@/ui/lib/dnd-utils'
import { formatSize } from '@/ui/lib/format'
import { useFieldStore } from '@/ui/stores/fields'
import { useUploadStore } from '@/ui/stores/upload'
import type {
  AssetInfo,
  CollectionInfo,
  CreateUploadTaskRequest,
  SearchCondition,
  SearchSort,
  ShareLinkInfo,
} from '@shumai/dtos'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Download, Loader2 } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ulid } from 'ulid'
import type { DragState } from '../dnd-types'
import { MoveCopyDialog } from '../move-copy-dialog'
import { FileBrowserContextMenu } from './context-menu'

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
import { ContextMenu, ContextMenuTrigger } from '../ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { FileCard } from './file-card'
import { FileListItem } from './file-list-item'
import { FolderCard } from './folder-card'
import { FileBrowserGridView } from './grid-view'
import { FileBrowserListView } from './list-view'
import { FileBrowserToolbar } from './toolbar'
import { useFileActions } from './use-file-actions'

interface FileBrowserProps {
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
  onSaveField: (fileId: string, fieldId: string, value: unknown) => void
  displayStyle: 'card' | 'list'
  onClearSelection: () => void
  fetchNextFoldersPage: () => void
  hasNextFoldersPage: boolean
  isFetchingNextFoldersPage: boolean
  fetchNextFilesPage: () => void
  hasNextFilesPage: boolean
  isFetchingNextFilesPage: boolean
  isRecentlyDeleted?: boolean
  filterConditions?: SearchCondition[]
  onFilterChange?: (conditions: SearchCondition[]) => void
  sort?: SearchSort
  onSortChange?: (sort?: SearchSort) => void
  dragState?: DragState
  isShareView?: boolean
  isPublic?: boolean
  onRemoveFromShare?: (items: AssetInfo[]) => void
  fieldVisibility?: Record<string, boolean>
  collection?: CollectionInfo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdateCollection?: (updates: { name?: string; filter?: any }) => void
  rootFolderId?: string
}

type FileWithId = {
  file: File
  id: string
}

let filesToUpload: FileWithId[] = []

export function FileBrowser({
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
  displayStyle,
  onClearSelection,
  fetchNextFoldersPage,
  hasNextFoldersPage,
  isFetchingNextFoldersPage,
  fetchNextFilesPage,
  hasNextFilesPage,
  isFetchingNextFilesPage,
  isRecentlyDeleted,
  filterConditions,
  onFilterChange,
  sort,
  onSortChange,
  dragState,
  isShareView,
  isPublic,
  onRemoveFromShare,
  fieldVisibility,
  collection,
  onUpdateCollection,
  rootFolderId,
}: FileBrowserProps) {
  const [contextMenuItem, setContextMenuItem] = useState<AssetInfo | null>(null)
  const [moveCopyMode, setMoveCopyMode] = useState<'move' | 'copy' | null>(null)
  const [itemsToMoveCopy, setItemsToMoveCopy] = useState<AssetInfo[]>([])
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [isExternalDragging, setIsExternalDragging] = useState(false)
  const [externalOverFolderId, setExternalOverFolderId] = useState<string | null>(null)
  const dragCounter = useRef(0)

  const resetExternalDragState = useCallback(() => {
    setIsExternalDragging(false)
    setExternalOverFolderId(null)
    dragCounter.current = 0
  }, [])

  // Prevent default window behavior to avoid browser replacing page on accidental drops
  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault()
    }
    window.addEventListener('dragover', preventDefault)
    window.addEventListener('drop', preventDefault)
    return () => {
      window.removeEventListener('dragover', preventDefault)
      window.removeEventListener('drop', preventDefault)
    }
  }, [])

  const handleGlobalDragEnter = (e: React.DragEvent) => {
    if (!canEdit || isRecentlyDeleted || isShareView || isPublic || !!collection) return
    e.preventDefault()
    if (e.dataTransfer.types.includes('Files')) {
      dragCounter.current++
      setIsExternalDragging(true)
    }
  }

  const handleGlobalDragLeave = (e: React.DragEvent) => {
    if (!canEdit || isRecentlyDeleted || isShareView || isPublic || !!collection) return
    e.preventDefault()
    if (e.dataTransfer.types.includes('Files')) {
      dragCounter.current--
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setIsExternalDragging(false)
        setExternalOverFolderId(null)
      }
    }
  }

  const handleGlobalDragOver = (e: React.DragEvent) => {
    if (!canEdit || isRecentlyDeleted || isShareView || isPublic || !!collection) return
    e.preventDefault()
  }

  const handleGlobalDrop = async (e: React.DragEvent) => {
    if (!canEdit || isRecentlyDeleted || isShareView || isPublic || !!collection) return
    e.preventDefault()
    e.stopPropagation()

    const files = await getAllFilesFromEntries(e.dataTransfer)

    resetExternalDragState()

    if (files.length > 0) {
      processAndUploadFiles(files)
    }
  }

  const [localUploadingFiles, setLocalUploadingFiles] = useState<AssetInfo[]>([])

  const displayedFiles = useMemo(() => {
    const existingIds = new Set(files.map((f) => f.id))
    const filteredLocal = localUploadingFiles.filter((f) => !existingIds.has(f.id))
    return [...filteredLocal, ...files]
  }, [files, localUploadingFiles])

  const { data: shareLinksData } = useQuery({
    queryKey: ['shares', projectId, 'list'],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].shares.$get({
        param: { projectId },
        query: { first: '100' },
      })
      if (!res.ok) throw new Error('Failed to fetch share links')
      return (await res.json()) as unknown as { data: ShareLinkInfo[] }
    },
    enabled: !!projectId && !isPublic,
  })

  const $reparent = client.api.projects[':projectId'].reparent.$post
  const { mutate: reparentAssets } = useMutation<
    InferResponseType<typeof $reparent, 204>,
    Error,
    InferRequestType<typeof $reparent>
  >({
    mutationFn: async (request) => {
      const res = await $reparent(request)
      if (!res.ok) throw new Error('Failed to move assets')
      return null as unknown as InferResponseType<typeof $reparent, 204>
    },
  })

  const $copy = client.api.projects[':projectId'].copy.$post
  const { mutate: copyAssets } = useMutation<
    InferResponseType<typeof $copy, 204>,
    Error,
    InferRequestType<typeof $copy>
  >({
    mutationFn: async (request) => {
      const res = await $copy(request)
      if (!res.ok) throw new Error('Failed to copy assets')
      return null as unknown as InferResponseType<typeof $copy, 204>
    },
  })

  const handleMoveCopyConfirm = async (targetFolderId: string, withComments: boolean) => {
    const assetIds = itemsToMoveCopy.map((i) => i.id!)
    if (moveCopyMode === 'move') {
      reparentAssets(
        {
          param: { projectId },
          json: { newParentId: targetFolderId, assetIds },
        },
        {
          onSuccess: () => {
            toast.success(`Successfully moved ${assetIds.length} item(s)`, {
              action: {
                label: 'Go to folder',
                onClick: () => {
                  navigate({
                    to: '/projects/$projectId/folders/$folderId',
                    params: { projectId, folderId: targetFolderId },
                  })
                },
              },
            })
            queryClient.invalidateQueries({ queryKey: ['search', teamId] })
            queryClient.invalidateQueries({ queryKey: ['folders'] })
            setMoveCopyMode(null)
            setItemsToMoveCopy([])
            onClearSelection()
          },
          onError: (err) => {
            toast.error(`Error: ${err.message}`)
          },
        },
      )
    } else {
      copyAssets(
        {
          param: { projectId },
          json: { newParentId: targetFolderId, assetIds, withComments },
        },
        {
          onSuccess: () => {
            toast.success(`Successfully copied ${assetIds.length} item(s)`, {
              action: {
                label: 'Go to folder',
                onClick: () => {
                  navigate({
                    to: '/projects/$projectId/folders/$folderId',
                    params: { projectId, folderId: targetFolderId },
                  })
                },
              },
            })
            queryClient.invalidateQueries({ queryKey: ['search', teamId] })
            queryClient.invalidateQueries({ queryKey: ['folders'] })
            setMoveCopyMode(null)
            setItemsToMoveCopy([])
            onClearSelection()
          },
          onError: (err) => {
            toast.error(`Error: ${err.message}`)
          },
        },
      )
    }
  }

  const { mutate: createShareLink } = useMutation({
    mutationFn: async (items: AssetInfo[]) => {
      const name =
        items.length === 1
          ? items[0].name
          : new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })

      const res = await client.api.projects[':projectId'].shares.$post({
        param: { projectId },
        json: { name },
      })
      if (!res.ok) throw new Error('Failed to create share link')
      const share = await res.json()

      // Add assets to the new share link
      const assetsRes = await client.api.shares[':shareId'].assets.$post({
        param: { shareId: share.id },
        json: { assetIds: items.map((i) => i.id!) },
      })
      if (!assetsRes.ok) throw new Error('Failed to add assets to share link')

      return share
    },
    onSuccess: (share) => {
      queryClient.invalidateQueries({ queryKey: ['shares', projectId] })
      toast.success('Share link created', {
        action: {
          label: 'View',
          onClick: () =>
            navigate({
              to: '/projects/$projectId/shares/$shareId',
              params: { projectId, shareId: share.id },
            }),
        },
      })
    },
  })

  const { mutate: addToShareLink } = useMutation({
    mutationFn: async ({ shareId, items }: { shareId: string; items: AssetInfo[] }) => {
      const res = await client.api.shares[':shareId'].assets.$post({
        param: { shareId },
        json: { assetIds: items.map((i) => i.id!) },
      })
      if (!res.ok) throw new Error('Failed to add assets')
      return { shareId }
    },
    onSuccess: ({ shareId }) => {
      toast.success('Added to share link', {
        action: {
          label: 'View',
          onClick: () =>
            navigate({
              to: '/projects/$projectId/shares/$shareId',
              params: { projectId, shareId },
            }),
        },
      })
    },
  })

  const handleCreateShareLink = (items: AssetInfo[]) => {
    createShareLink(items)
  }

  const handleAddToShareLink = (shareId: string, items: AssetInfo[]) => {
    addToShareLink({ shareId, items })
  }

  const {
    editingItemId,
    setEditingItemId,
    handleNewFolder,
    handleDelete,
    handleRename,
    handleRestore,
    handleDownload,
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
    files: displayedFiles,
    selectedIds,
  })

  const [isEmptyTrashDialogOpen, setIsEmptyTrashDialogOpen] = useState(false)
  const { mutate: emptyTrash, isPending: isEmptyingTrash } = useMutation({
    mutationFn: async () => {
      const res = await client.api.projects[':projectId']['empty-trash'].$post({
        param: { projectId },
      })
      if (!res.ok) throw new Error('Failed to empty trash')
      return await res.json()
    },
    onSuccess: () => {
      toast.success('Trash emptied successfully')
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'recently-deleted'],
      })
      onClearSelection()
      setIsEmptyTrashDialogOpen(false)
    },
    onError: (err) => {
      toast.error(`Error emptying trash: ${err.message}`)
    },
  })

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
      return { files: [...filesToUpload] }
    },
    onSuccess: async (data, variables, context) => {
      const currentFiles = context?.files || []
      const isCurrentFolderUpload = variables.json.parentId === assetId

      // Register task and files in the store for real-time progress tracking
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

      if (isCurrentFolderUpload) {
        const newLocalFiles: AssetInfo[] = currentFiles
          .filter((f) => {
            const path = (f.file.webkitRelativePath || f.file.name).split('/')
            return path.length === 1
          })
          .map((f) => {
            const urlInfo = (
              data.presignedUrls as { id?: string; url?: string; fileId?: string }[] | undefined
            )?.find((p) => p.id === f.id)
            const hasUrl = !!urlInfo && !!urlInfo.url
            return {
              id: urlInfo?.fileId || f.id,
              name: f.file.name,
              sizeByte: f.file.size,
              fileCount: 0,
              type: 'file',
              status: hasUrl ? 'uploading' : 'error',
              mediaType: f.file.type || null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          })
        setLocalUploadingFiles((prev) => [...newLocalFiles, ...prev])
      }

      // Invalidate queries immediately so any newly created folders appear
      queryClient.invalidateQueries({
        queryKey: ['search', teamId, assetId],
      })

      // The RPC client returns an object that we cast to the expected type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await uploadFiles(currentFiles, data.presignedUrls as any, data.taskId!)
      queryClient.invalidateQueries({
        queryKey: ['search', teamId, assetId],
      })
    },
  })

  const incrementUploading = useUploadStore((state) => state.increment)
  const decrementUploading = useUploadStore((state) => state.decrement)
  const startTask = useUploadStore((state) => state.startTask)
  const updateFileProgress = useUploadStore((state) => state.updateFileProgress)
  const completeFile = useUploadStore((state) => state.completeFile)
  const failFile = useUploadStore((state) => state.failFile)
  const { fields } = useFieldStore()
  const displayedFields = useMemo(() => {
    if (!isShareView) return fields.filter((f) => f.visible)
    return fields.filter((f) => fieldVisibility?.[f.id!])
  }, [fields, isShareView, fieldVisibility])

  const [foldersExpanded, setFoldersExpanded] = React.useState(true)
  const [filesExpanded, setFilesExpanded] = React.useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const newVersionInputRef = useRef<HTMLInputElement>(null)
  const [targetVersionFileId, setTargetVersionFileId] = useState<string | null>(null)
  const fileContextMenu = useRef(false)
  const { canEdit, canAdmin } = usePermissions(projectId)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const foldersSize = folders.reduce((acc, f) => acc + (f.sizeByte || 0), 0)
  const filesSize = displayedFiles.reduce((acc, f) => acc + (f.sizeByte || 0), 0)

  const formatCount = (count: number, isFile: boolean) => {
    const isNameFilter = filterConditions?.some(
      (c) => c.field === 'name' && c.operator === 'contains',
    )
    if (isNameFilter && count === 10001) {
      return `10000+ ${isFile ? 'Asset' : 'Folder'}s`
    }
    return `${count} ${isFile ? 'Asset' : 'Folder'}${count !== 1 ? 's' : ''}`
  }

  const handleEmptyAreaClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // Clear selection if we didn't click on a card/row, button, or other interactive element
    // Also ignore clicks on context menu items (which might bubble via React portals)
    if (target.closest('[role="menuitem"]') || target.closest('[data-radix-menu-content]')) {
      return
    }

    if (
      target === e.currentTarget ||
      target.closest('.empty-area') ||
      (!target.closest('.group') &&
        !target.closest('button') &&
        !target.closest('a') &&
        !target.closest('input'))
    ) {
      onClearSelection()
      setEditingItemId(null)
    }
  }

  const onContextMenu = (_e: React.MouseEvent, item?: AssetInfo) => {
    if (item === undefined) {
      // Two possibilities when item is undefined:
      // 1. User right-clicked on empty space → fileContextMenu should be false.
      // 2. A right-click on a file/folder was already handled above → fileContextMenu is true.
      //    In that case, toggle it off; otherwise clear the selected item.
      if (fileContextMenu.current) {
        fileContextMenu.current = false
      } else {
        setContextMenuItem(null)
      }
    } else {
      // User right-clicked a file or folder.
      // Mark that this click is for a file context menu, store the item,
      // and let the event bubble so the empty-area handler manages positioning.
      fileContextMenu.current = true
      setContextMenuItem(item ?? null)
      return
    }
  }

  const renderItem = (item: AssetInfo, columnSizing?: Record<string, number>) => {
    const effectiveType = item.type === 'symlink' ? item.targetType || 'file' : item.type
    const props = {
      teamId,
      item: item,
      isSelected: selectedItem?.id === item.id,
      isChecked: selectedIds.has(item.id!),
      isEditing: editingItemId === item.id,
      onSelect: onItemSelect,
      onDoubleClick: onItemDoubleClick,
      onContextMenu: onContextMenu,
      onDragStart: () => {}, // Handled by dnd-kit
      onDrop: () => {}, // Handled by dnd-kit
      onRename: (newName: string) => onRenameSubmit(item, newName),
      onFinishEditing: () => setEditingItemId(null),
      onSaveField: (fieldId: string, value: unknown) => {
        onSaveField(item.id!, fieldId, value)
      },
      dragState,
      onAction: (action: string, item: AssetInfo) => {
        if (isShareView) {
          if (action === 'remove-from-share') {
            const isSelected = selectedIds.has(item.id!)
            const targetItems = isSelected
              ? [...folders, ...files].filter((i) => selectedIds.has(i.id!))
              : [item]
            onRemoveFromShare?.(targetItems)
          }
          return
        }
        handleAction(action as 'rename' | 'delete' | 'download' | 'restore', item)
      },
      isRecentlyDeleted,
      selectedCount: selectedIds.size,
      isShareView,
      fields: displayedFields,
      canEdit,
      isExternalDragging,
      externalOverFolderId,
      setExternalOverFolderId,
      resetExternalDragState,
      onExternalDrop: (files: File[], folderId: string) => {
        processAndUploadFiles(files, folderId)
      },
    }
    if (displayStyle === 'card') {
      if (effectiveType === 'folder') return <FolderCard key={item.id} {...props} />
      if (effectiveType === 'file' || effectiveType === 'version_stack')
        return <FileCard key={item.id} {...props} />
    }
    return <FileListItem key={item.id} {...props} columnSizing={columnSizing} />
  }

  const selectedCount = selectedIds.size
  const selectedFolders = Array.from(selectedIds).filter((id) =>
    folders.find((item) => item.id === id),
  ).length
  const selectedFiles = Array.from(selectedIds).filter((id) =>
    displayedFiles.find((item) => item.id === id),
  ).length
  const selectedSize = Array.from(selectedIds).reduce((acc, id) => {
    const item = folders.find((f) => f.id === id) || displayedFiles.find((f) => f.id === id)
    return acc + (item?.sizeByte || 0)
  }, 0)

  const handleUploadFilesClick = () => {
    fileInputRef.current?.click()
  }

  const handleUploadFolderClick = () => {
    folderInputRef.current?.click()
  }

  const uploadFiles = async (
    files: FileWithId[],
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
    const filesToUpload = [...files]

    const uploadNext = async () => {
      while (filesToUpload.length > 0) {
        const file = filesToUpload.shift()
        if (file) {
          const uploadInfo = uploadUrlMap[file.id]
          if (uploadInfo && uploadInfo.url) {
            incrementUploading()
            try {
              try {
                const xhr = new XMLHttpRequest()
                const uploadPromise = new Promise<{ ok: boolean; status: number }>(
                  (resolve, reject) => {
                    xhr.open('PUT', uploadInfo.url)
                    xhr.setRequestHeader('Content-Type', file.file.type)

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

                    xhr.onerror = () => {
                      reject(new Error('Network error'))
                    }

                    xhr.onabort = () => {
                      reject(new Error('Upload aborted'))
                    }

                    xhr.send(file.file)
                  },
                )

                const resp = await uploadPromise

                if (resp.ok) {
                  completeFile(taskId, uploadInfo.fileId)
                  await confirmUpload({
                    param: { teamId: teamId!, taskId: taskId },
                    json: {
                      fileId: uploadInfo.fileId,
                    },
                  })
                } else {
                  failFile(taskId, uploadInfo.fileId)
                  toast.error(`Failed to upload file: ${file.file.name}`)
                  await confirmUpload({
                    param: { teamId: teamId!, taskId: taskId },
                    json: {
                      fileId: uploadInfo.fileId,
                      errorMessage: `upload failed with status: ${resp.status}`,
                    },
                  })
                  return
                }
              } catch (error) {
                failFile(taskId, uploadInfo.fileId)
                toast.error(`Failed to upload file: ${file.file.name}`)
                await confirmUpload({
                  param: { teamId: teamId!, taskId: taskId },
                  json: {
                    fileId: uploadInfo.fileId,
                    errorMessage: `upload failed with error: ${error instanceof Error ? error.message : String(error)}`,
                  },
                })
                return
              }
            } finally {
              decrementUploading()
              await queryClient.invalidateQueries({
                queryKey: ['search', teamId, assetId],
              })
              setLocalUploadingFiles((prev) =>
                prev.filter((f) => f.id !== uploadInfo.fileId && f.id !== file.id),
              )
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

  const processAndUploadFiles = useCallback(
    (files: FileList | File[], overrideParentId?: string) => {
      if (!files || files.length === 0) return

      const fileWithIds: FileWithId[] = []
      const root: CreateUploadTaskRequest['files'] = []
      const directories = new Map<string, CreateUploadTaskRequest['files']>()

      for (const file of files) {
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
        currentLevel.push({
          name: fileName,
          size: file.size,
          type: 'file',
          id: fileWithId.id,
          children: [],
          mediaType: file.type,
        })
      }
      filesToUpload = fileWithIds
      createUploadTaskMutation({
        param: { teamId: teamId },
        json: {
          parentId: overrideParentId || assetId,
          files: root,
        },
      })
    },
    [assetId, createUploadTaskMutation, teamId],
  )

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processAndUploadFiles(event.target.files!)
  }

  const handleNewVersionClick = (item: AssetInfo) => {
    setTargetVersionFileId(item.id!)
    newVersionInputRef.current?.click()
  }

  const handleNewVersionFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && targetVersionFileId) {
      processAndUploadFiles(event.target.files, targetVersionFileId)
      setTargetVersionFileId(null)
      // Reset input
      event.target.value = ''
    }
  }

  const handlePaste = useCallback(
    (e: React.ClipboardEvent | ClipboardEvent) => {
      if (!canEdit || isShareView || !!collection) return
      if (!e.clipboardData) return
      const items = e.clipboardData.items
      const files: File[] = []

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) {
            // If it's a raw image without a real name (e.g. "image.png" from clipboard image)
            if (file.name === 'image.png' && file.type.startsWith('image/')) {
              const timestamp = new Date()
                .toISOString()
                .replace(/[:.]/g, '')
                .replace('T', '_')
                .substring(0, 15)
              const ext = file.type.split('/')[1] || 'png'
              const newFile = new File([file], `pasted_image_${timestamp}.${ext}`, {
                type: file.type,
              })
              files.push(newFile)
            } else {
              files.push(file)
            }
          }
        }
      }

      if (files.length > 0) {
        processAndUploadFiles(files)
      }
    },
    [processAndUploadFiles, isShareView, collection, canEdit],
  )

  // Add global paste listener if browser is active
  useEffect(() => {
    const onGlobalPaste = (e: ClipboardEvent) => {
      if (!canEdit || isShareView || !!collection) return
      // Don't intercept if user is typing in an input
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA' ||
          (document.activeElement as HTMLElement).isContentEditable)
      ) {
        return
      }
      handlePaste(e)
    }

    window.addEventListener('paste', onGlobalPaste)
    return () => {
      window.removeEventListener('paste', onGlobalPaste)
    }
  }, [handlePaste, isShareView, collection, canEdit])

  const renderContent = () => {
    return (
      <ContextMenu modal={false}>
        <ContextMenuTrigger asChild disabled={isShareView || isPublic || !!collection}>
          <div
            className="flex-1 bg-background relative flex flex-col min-h-0 overflow-hidden"
            onContextMenu={(e) => onContextMenu(e)}
            onDragEnter={handleGlobalDragEnter}
            onDragLeave={handleGlobalDragLeave}
            onDragOver={handleGlobalDragOver}
            onDrop={handleGlobalDrop}
          >
            {!isShareView && !isPublic && onFilterChange && onSortChange && (
              <FileBrowserToolbar
                teamId={teamId}
                projectId={projectId}
                assetId={assetId}
                fields={fields || []}
                filterConditions={filterConditions || []}
                onFilterChange={onFilterChange}
                sort={sort}
                onSortChange={onSortChange}
                isRecentlyDeleted={isRecentlyDeleted}
                collection={collection}
                onUpdateCollection={onUpdateCollection}
                rootFolderId={rootFolderId}
              />
            )}
            {isRecentlyDeleted && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-b border-border text-sm shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>{m.recently_deleted_notice()}</span>
                </div>
                {canAdmin && (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={
                      isEmptyingTrash || (folders.length === 0 && displayedFiles.length === 0)
                    }
                    onClick={() => setIsEmptyTrashDialogOpen(true)}
                    className="h-8 px-3 text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-destructive-foreground transition-all duration-200"
                  >
                    Delete Now
                  </Button>
                )}
              </div>
            )}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto min-h-0 relative flex flex-col"
              style={{ overflowAnchor: 'none' }}
            >
              {displayStyle === 'list' ? (
                <FileBrowserListView
                  folders={folders}
                  files={displayedFiles}
                  totalFolders={totalFolders}
                  totalFiles={totalFiles}
                  totalFoldersSize={totalFoldersSize}
                  totalFilesSize={totalFilesSize}
                  selectedItem={selectedItem}
                  selectedIds={selectedIds}
                  displayedFields={displayedFields}
                  onItemSelect={onItemSelect}
                  onItemDoubleClick={onItemDoubleClick}
                  renderItem={renderItem}
                  foldersExpanded={foldersExpanded}
                  setFoldersExpanded={setFoldersExpanded}
                  filesExpanded={filesExpanded}
                  setFilesExpanded={setFilesExpanded}
                  hasNextFoldersPage={hasNextFoldersPage}
                  hasNextFilesPage={hasNextFilesPage}
                  isFetchingNextFoldersPage={isFetchingNextFoldersPage}
                  isFetchingNextFilesPage={isFetchingNextFilesPage}
                  fetchNextFoldersPage={fetchNextFoldersPage}
                  fetchNextFilesPage={fetchNextFilesPage}
                  formatCount={formatCount}
                  formatSize={formatSize}
                  foldersSize={foldersSize}
                  filesSize={filesSize}
                  handleEmptyAreaClick={handleEmptyAreaClick}
                  dragState={dragState}
                  sort={sort}
                  isExternalDragging={isExternalDragging}
                  externalOverFolderId={externalOverFolderId}
                  setExternalOverFolderId={setExternalOverFolderId}
                  resetExternalDragState={resetExternalDragState}
                  onExternalDrop={(files, folderId) => processAndUploadFiles(files, folderId)}
                />
              ) : (
                <FileBrowserGridView
                  folders={folders}
                  files={displayedFiles}
                  totalFolders={totalFolders}
                  totalFiles={totalFiles}
                  totalFoldersSize={totalFoldersSize}
                  totalFilesSize={totalFilesSize}
                  renderItem={renderItem}
                  foldersExpanded={foldersExpanded}
                  setFoldersExpanded={setFoldersExpanded}
                  filesExpanded={filesExpanded}
                  setFilesExpanded={setFilesExpanded}
                  hasNextFoldersPage={hasNextFoldersPage}
                  hasNextFilesPage={hasNextFilesPage}
                  isFetchingNextFoldersPage={isFetchingNextFoldersPage}
                  isFetchingNextFilesPage={isFetchingNextFilesPage}
                  fetchNextFoldersPage={fetchNextFoldersPage}
                  fetchNextFilesPage={fetchNextFilesPage}
                  formatCount={formatCount}
                  formatSize={formatSize}
                  foldersSize={foldersSize}
                  filesSize={filesSize}
                  handleEmptyAreaClick={handleEmptyAreaClick}
                  dragState={dragState}
                  sort={sort}
                  scrollContainerRef={scrollContainerRef}
                />
              )}

              {(isFetchingNextFoldersPage || isFetchingNextFilesPage) && (
                <div className="flex justify-center items-center p-4">
                  <p>Loading more...</p>
                </div>
              )}

              {folders.length === 0 &&
                displayedFiles.length === 0 &&
                !isFetchingNextFoldersPage &&
                !isFetchingNextFilesPage && (
                  <div className="empty-area flex h-full items-center justify-center text-sm text-muted-foreground">
                    This folder is empty
                  </div>
                )}
            </div>

            {selectedCount > 0 && (
              <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-between shrink-0">
                <div className="text-sm text-muted-foreground">
                  {selectedFolders > 0 && selectedFiles > 0 && (
                    <span>
                      {selectedCount} Item{selectedCount !== 1 ? 's' : ''} selected •{' '}
                      {formatSize(selectedSize)}
                    </span>
                  )}
                  {selectedFolders > 0 && selectedFiles === 0 && (
                    <span>
                      {selectedFolders} folder{selectedFolders !== 1 ? 's' : ''} selected •{' '}
                      {formatSize(selectedSize)}
                    </span>
                  )}
                  {selectedFolders === 0 && selectedFiles > 0 && (
                    <span>
                      {selectedFiles} file{selectedFiles !== 1 ? 's' : ''} selected •{' '}
                      {formatSize(selectedSize)}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleDownload(
                      [...folders, ...displayedFiles].filter((i) => selectedIds.has(i.id!)),
                    )
                  }
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            )}
            {isExternalDragging && !externalOverFolderId && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-primary/80 text-primary-foreground shadow-lg shadow-primary/20 border border-primary/20 backdrop-blur-md">
                  <span className="font-medium text-sm">Drop files here to upload</span>
                </div>
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <FileBrowserContextMenu
          item={contextMenuItem}
          selectedIds={selectedIds}
          folders={folders}
          files={displayedFiles}
          onRename={handleRename}
          onDelete={handleDelete}
          onDownload={handleDownload}
          onNewFolder={handleNewFolder}
          onUploadFile={handleUploadFilesClick}
          onUploadFolder={handleUploadFolderClick}
          onNewVersion={handleNewVersionClick}
          onMoveTo={(items) => {
            setItemsToMoveCopy(items)
            setMoveCopyMode('move')
          }}
          onCopyTo={(items) => {
            setItemsToMoveCopy(items)
            setMoveCopyMode('copy')
          }}
          onRestore={handleRestore}
          isRecentlyDeleted={isRecentlyDeleted}
          shareLinks={shareLinksData?.data ?? []}
          onCreateShareLink={handleCreateShareLink}
          onAddToShareLink={handleAddToShareLink}
          canEdit={canEdit}
        />
      </ContextMenu>
    )
  }

  return (
    <>
      {canEdit && (
        <>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <input
            type="file"
            ref={folderInputRef}
            multiple
            /* @ts-expect-error - webkitdirectory is not in the type definition */
            webkitdirectory="true"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <input
            type="file"
            ref={newVersionInputRef}
            style={{ display: 'none' }}
            onChange={handleNewVersionFileChange}
          />
        </>
      )}
      {renderContent()}

      {moveCopyMode && (
        <MoveCopyDialog
          isOpen={!!moveCopyMode}
          onClose={() => setMoveCopyMode(null)}
          onConfirm={handleMoveCopyConfirm}
          mode={moveCopyMode}
          teamId={teamId}
          currentProjectId={projectId}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleted items can be recovered for 30 days before being permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmDelete()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isEmptyTrashDialogOpen} onOpenChange={setIsEmptyTrashDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              All items in the recently deleted folder will be permanently removed both from the
              database and from storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                emptyTrash()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isEmptyingTrash}
            >
              {isEmptyingTrash ? 'Deleting...' : 'Delete Now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isDownloadDialogOpen} onOpenChange={setIsDownloadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isLoadingLinks ? 'Preparing Download' : 'Confirm Download'}</DialogTitle>
            <DialogDescription>
              {isLoadingLinks
                ? 'Resolving all files and folders. Please wait...'
                : 'Selected files and folders will be prepared for download.'}
            </DialogDescription>
          </DialogHeader>

          {isLoadingLinks ? (
            <div className="space-y-4 py-6 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm font-medium text-muted-foreground mt-2">
                Preparing download links...
              </span>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="text-sm text-muted-foreground">
                This download will include{' '}
                <span className="font-semibold text-foreground">{resolvedFiles.length}</span>{' '}
                file(s).
              </div>
              <div className="flex items-start gap-3 p-3 text-sm rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/30">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">No Folder Structure</p>
                  <p className="mt-0.5 text-xs text-amber-700/90 dark:text-amber-400/90">
                    Folder hierarchy will be flattened. All nested files will be downloaded directly
                    into your default download folder.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {!isLoadingLinks ? (
              <>
                <Button variant="outline" onClick={() => setIsDownloadDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={startDownload}
                  className="gap-2"
                  disabled={resolvedFiles.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Start Download
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsDownloadDialogOpen(false)}>
                Cancel
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
