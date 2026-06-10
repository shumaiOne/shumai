'use client'
import { client } from '@/ui/api/client'
import type { InferRequestType, InferResponseType } from 'hono/client'

import type { AssetInfo } from '@shumai/dtos'
import type { CollectionInfo } from '@shumai/dtos'
import type { SearchCondition, SearchSort } from '@shumai/dtos'
import type { ShareLinkInfo } from '@shumai/dtos'
import type { CreateUploadTaskRequest } from '@shumai/dtos'
import { formatSize } from '@/ui/lib/format'
import { usePermissions } from '@/ui/hooks/use-permissions'
import { useFieldStore } from '@/ui/stores/fields'
import { useUploadStore } from '@/ui/stores/upload'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Download } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
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

  const [localUploadingFiles, setLocalUploadingFiles] = useState<AssetInfo[]>([])

  const displayedFiles = useMemo(() => {
    const existingIds = new Set(files.map((f) => f.id))
    const filteredLocal = localUploadingFiles.filter((f) => !existingIds.has(f.id))
    return [...filteredLocal, ...files]
  }, [files, localUploadingFiles])

  const { data: shareLinksData } = useQuery({
    queryKey: ['shares', projectId],
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
            queryClient.invalidateQueries({ queryKey: ['folders', teamId] })
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
            queryClient.invalidateQueries({ queryKey: ['folders', teamId] })
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
  } = useFileActions({
    teamId,
    projectId,
    assetId,
    folders,
    files: displayedFiles,
    selectedIds,
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
    InferRequestType<typeof $createUploadTask>
  >({
    mutationFn: async (request) => {
      const res = await $createUploadTask(request)
      if (!res.ok) throw new Error('Failed to create upload task')
      return (await res.json()) as InferResponseType<typeof $createUploadTask>
    },
    onSuccess: async (data, variables) => {
      const isCurrentFolderUpload = variables.json.parentId === assetId

      if (isCurrentFolderUpload) {
        const newLocalFiles: AssetInfo[] = filesToUpload
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
      await uploadFiles(filesToUpload, data.presignedUrls as any, data.taskId!)
      queryClient.invalidateQueries({
        queryKey: ['search', teamId, assetId],
      })
    },
  })

  const incrementUploading = useUploadStore((state) => state.increment)
  const decrementUploading = useUploadStore((state) => state.decrement)
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
  const { canEdit } = usePermissions()

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
                const resp = await fetch(uploadInfo.url, {
                  method: 'PUT',
                  body: file.file,
                  headers: {
                    'Content-Type': file.file.type,
                  },
                })

                if (resp.ok) {
                  await confirmUpload({
                    param: { teamId: teamId, taskId: taskId },
                    json: {
                      fileId: uploadInfo.fileId,
                    },
                  })
                } else {
                  toast.error(`Failed to upload file: ${file.file.name}`)
                  await confirmUpload({
                    param: { teamId: teamId, taskId: taskId },
                    json: {
                      fileId: uploadInfo.fileId,
                      errorMessage: `upload failed with status: ${resp.status}`,
                    },
                  })
                  return
                }
              } catch (error) {
                toast.error(`Failed to upload file: ${file.file.name}`)
                await confirmUpload({
                  param: { teamId: teamId, taskId: taskId },
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
              id: crypto.randomUUID(),
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
        const fileWithId = { file, id: crypto.randomUUID() }
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
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto min-h-0 relative flex flex-col"
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
                      {selectedFolders} folder
                      {selectedFolders !== 1 ? 's' : ''}, {selectedFiles} file
                      {selectedFiles !== 1 ? 's' : ''} selected
                    </span>
                  )}
                  {selectedFolders > 0 && selectedFiles === 0 && (
                    <span>
                      {selectedFolders} folder
                      {selectedFolders !== 1 ? 's' : ''} selected
                    </span>
                  )}
                  {selectedFolders === 0 && selectedFiles > 0 && (
                    <span>
                      {selectedFiles} file{selectedFiles !== 1 ? 's' : ''} selected
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
    </>
  )
}
