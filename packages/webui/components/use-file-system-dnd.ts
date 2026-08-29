'use client'

import { client } from '@/ui/api/client'
import type { InferRequestType, InferResponseType } from 'hono/client'
import type { AssetInfo, AssetInfoPaginatedList, SearchSort } from '@shumai/dtos'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/react'
import type { DragState } from './dnd-types'
import { useChatbotStore } from '@/ui/stores/chatbot'

interface UseFileSystemDndProps {
  teamId: string
  projectId: string
  assetId: string
  folders: AssetInfo[]
  files: AssetInfo[]
  selectedIds: Set<string>
  onClearSelection: () => void
}

export function useFileSystemDnd({
  teamId,
  projectId,
  assetId,
  folders,
  files,
  selectedIds,
  onClearSelection,
}: UseFileSystemDndProps) {
  const queryClient = useQueryClient()
  const [dragState, setDragState] = useState<DragState | undefined>(undefined)

  const updateLocalCache = (isFolder: boolean, updatedItem: AssetInfo) => {
    const assetType = isFolder ? 'folder' : 'file'
    const queryKeyPrefix = ['search', teamId, assetId, assetType]

    const queries = queryClient.getQueriesData<InfiniteData<AssetInfoPaginatedList>>({
      queryKey: queryKeyPrefix,
    })

    const isSearchSort = (val: unknown): val is SearchSort => {
      if (typeof val !== 'object' || val === null) return false
      const obj = val as Record<string, unknown>
      return (
        'field' in obj &&
        'order' in obj &&
        typeof obj.field === 'string' &&
        (obj.order === 'asc' || obj.order === 'desc')
      )
    }

    for (const [queryKey, oldData] of queries) {
      if (!oldData || !Array.isArray(oldData.pages)) continue

      const sort = queryKey.find(isSearchSort)

      const allItems = oldData.pages.flatMap((page) => page.data ?? [])

      const itemIndex = allItems.findIndex((item) => item.id === updatedItem.id)
      if (itemIndex === -1) {
        continue
      }

      allItems[itemIndex] = { ...allItems[itemIndex], ...updatedItem }

      if (sort?.field === 'custom') {
        const isDesc = sort.order === 'desc'
        allItems.sort((a, b) => {
          const indexA = a.sortIndex ?? ''
          const indexB = b.sortIndex ?? ''
          if (indexA === indexB) return 0
          if (isDesc) {
            return indexA < indexB ? 1 : -1
          } else {
            return indexA < indexB ? -1 : 1
          }
        })
      }

      let pointer = 0
      const newPages = oldData.pages.map((page) => {
        const pageSize = page.data ? page.data.length : 0
        const pageData = allItems.slice(pointer, pointer + pageSize)
        pointer += pageSize
        return {
          ...page,
          data: pageData,
        }
      })

      queryClient.setQueryData<InfiniteData<AssetInfoPaginatedList>>(queryKey, {
        ...oldData,
        pages: newPages,
      })
    }
  }

  const $reparent = client.api.projects[':projectId'].reparent.$post
  const { mutate: reparentAssets } = useMutation<
    InferResponseType<typeof $reparent, 204>,
    Error,
    InferRequestType<typeof $reparent>
  >({
    mutationFn: async (req) => {
      const res = await $reparent(req)
      if (!res.ok) throw new Error('Failed to move assets')
      return null as unknown as InferResponseType<typeof $reparent, 204>
    },
  })

  const $reorderFolder = client.api.folders[':folderId'].order.$patch
  const { mutate: reorderFolder } = useMutation<
    InferResponseType<typeof $reorderFolder, 200>,
    Error,
    InferRequestType<typeof $reorderFolder>
  >({
    mutationFn: async (req) => {
      const res = await $reorderFolder(req)
      if (!res.ok) throw new Error('Failed to reorder folder')
      return (await res.json()) as unknown as InferResponseType<typeof $reorderFolder, 200>
    },
  })

  const $reorderFile = client.api.files[':fileId'].order.$patch
  const { mutate: reorderFile } = useMutation<
    InferResponseType<typeof $reorderFile, 200>,
    Error,
    InferRequestType<typeof $reorderFile>
  >({
    mutationFn: async (req) => {
      const res = await $reorderFile(req)
      if (!res.ok) throw new Error('Failed to reorder file')
      return (await res.json()) as unknown as InferResponseType<typeof $reorderFile, 200>
    },
  })

  const $addAssetToShare = client.api.shares[':shareId'].assets.$post
  const { mutate: addAssetToShare } = useMutation<
    { addedCount: number },
    Error,
    InferRequestType<typeof $addAssetToShare>
  >({
    mutationFn: async (req) => {
      const res = await $addAssetToShare(req)
      if (!res.ok) throw new Error('Failed to add asset to share')
      return (await res.json()) as { addedCount: number }
    },
  })

  const handleDragStart = (event: DragStartEvent) => {
    const active = event.operation.source
    if (!active) return

    const activeId = (active.id as string).split(':').pop()!
    const activeData = active.data as { type: string; item: AssetInfo } | undefined

    if (!activeData) return

    let draggedIds: Set<string>
    let draggedItems: AssetInfo[]

    // If active item is in selection, we drag the whole selection
    if (selectedIds.has(activeId)) {
      draggedIds = new Set(selectedIds)
      draggedItems = [...folders, ...files].filter((item) => selectedIds.has(item.id!))
    } else {
      // Otherwise we drag only the active item
      draggedIds = new Set([activeId])
      draggedItems = [activeData.item]
    }

    const hasFolders = draggedItems.some((item) => item.type === 'folder')
    const isSingleFile =
      draggedIds.size === 1 && draggedItems.length === 1 && draggedItems[0].type === 'file'

    setDragState({
      isActive: true,
      draggedIds,
      hasFolders,
      isSingleFile,
      itemCount: draggedIds.size,
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { target } = event.operation

    if (target && dragState) {
      const targetId = (target.id as string).split(':').pop()!
      const targetData = target.data as { type: string; item: AssetInfo } | undefined

      if (targetData?.type === 'chatbot-sidebar') {
        const draggedItems = [...folders, ...files].filter((item) =>
          dragState.draggedIds.has(item.id!),
        )

        const chatAssets = draggedItems.map((item) => ({
          id: item.id!,
          name: item.name || 'Unnamed',
          type: item.type as 'file' | 'folder',
        }))

        useChatbotStore.getState().addAssets(chatAssets)
        onClearSelection()
        setDragState(undefined)
        return
      }

      if (targetData?.type === 'share-link') {
        const shareId = targetId
        const assetIds = Array.from(dragState.draggedIds)

        addAssetToShare(
          {
            param: { shareId },
            json: { assetIds },
          },
          {
            onSuccess: (data) => {
              if (data.addedCount === 0) {
                toast.info('Assets already exists in share')
              } else {
                toast.success(`Added ${data.addedCount} item(s) to share link`)
              }
              queryClient.invalidateQueries({
                queryKey: ['shares', projectId],
              })
              onClearSelection()
            },
            onError: (err) => {
              toast.error(`Failed to add to share: ${err.message}`)
            },
          },
        )

        setDragState(undefined)
        return
      }

      let isValid = false

      if (targetData && !dragState.draggedIds.has(targetId)) {
        if (targetData.type === 'folder' || targetData.type === 'reorder') {
          isValid = true
        } else if (targetData.type === 'file' || targetData.type === 'version_stack') {
          // Can only drop single regular file onto file or version stack
          if (dragState.isSingleFile) {
            isValid = true
          }
        }
      }

      if (targetData?.type === 'reorder') {
        const { position, item: targetItem } = targetData as unknown as {
          position: 'before' | 'after'
          item: AssetInfo
        }

        const isFolder = dragState.hasFolders
        const draggedId = Array.from(dragState.draggedIds)[0]

        if (isFolder) {
          reorderFolder(
            {
              param: { folderId: draggedId },
              json:
                position === 'before'
                  ? { beforeIndex: targetItem.sortIndex ?? undefined }
                  : { afterIndex: targetItem.sortIndex ?? undefined },
            },
            {
              onSuccess: (updatedFolder) => {
                toast.success('Folder reordered')
                updateLocalCache(true, updatedFolder)
                onClearSelection()
              },
              onError: (err) => {
                toast.error(`Failed to reorder: ${err.message}`)
              },
            },
          )
        } else {
          reorderFile(
            {
              param: { fileId: draggedId },
              json:
                position === 'before'
                  ? { beforeIndex: targetItem.sortIndex ?? undefined }
                  : { afterIndex: targetItem.sortIndex ?? undefined },
            },
            {
              onSuccess: (updatedFile) => {
                toast.success('File reordered')
                updateLocalCache(false, updatedFile)
                onClearSelection()
              },
              onError: (err) => {
                toast.error(`Failed to reorder: ${err.message}`)
              },
            },
          )
        }
      } else if (isValid) {
        // Execute API
        reparentAssets(
          {
            param: { projectId: projectId },
            json: {
              assetIds: Array.from(dragState.draggedIds),
              newParentId: targetId,
            },
          },
          {
            onSuccess: () => {
              toast.success('Assets moved successfully')
              queryClient.invalidateQueries({
                queryKey: ['search', teamId, assetId],
              })
              queryClient.invalidateQueries({
                queryKey: ['folders'],
              })
              // Clear selection after move
              onClearSelection()
            },
            onError: () => {
              toast.error('Failed to move assets')
            },
          },
        )
      }
    }

    setDragState(undefined)
  }

  return {
    dragState,
    handleDragStart,
    handleDragEnd,
  }
}
