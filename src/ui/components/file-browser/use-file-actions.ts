'use client'

import { client } from '@/ui/api/client'
import type { AssetInfo } from '@shumai/dtos'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InferRequestType, InferResponseType } from 'hono/client'
import { useState } from 'react'

interface UseFileActionsProps {
  teamId: string
  projectId: string
  assetId: string
  folders: AssetInfo[]
  files: AssetInfo[]
  selectedIds: Set<string>
}

export function useFileActions({
  teamId,
  projectId,
  assetId,
  folders,
  files,
  selectedIds,
}: UseFileActionsProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [itemsToDelete, setItemsToDelete] = useState<AssetInfo[]>([])
  const queryClient = useQueryClient()

  const $createFolder = client.api.folders.$post
  const { mutate: createFolder } = useMutation<
    InferResponseType<typeof $createFolder, 200>,
    Error,
    InferRequestType<typeof $createFolder>
  >({
    mutationFn: async (request) => {
      const res = await $createFolder(request)
      if (!res.ok) throw new Error('Failed to create')
      return (await res.json()) as unknown as InferResponseType<typeof $createFolder, 200>
    },
  })

  const $renameFolder = client.api.folders[':folderId'].$put
  const { mutate: renameFolder } = useMutation<
    InferResponseType<typeof $renameFolder, 200>,
    Error,
    InferRequestType<typeof $renameFolder>
  >({
    mutationFn: async (request) => {
      const res = await $renameFolder(request)
      if (!res.ok) throw new Error('Failed to rename')
      return (await res.json()) as unknown as InferResponseType<typeof $renameFolder, 200>
    },
  })

  const $renameFile = client.api.files[':fileId'].$put
  const { mutate: renameFile } = useMutation<
    InferResponseType<typeof $renameFile, 200>,
    Error,
    InferRequestType<typeof $renameFile>
  >({
    mutationFn: async (request) => {
      const res = await $renameFile(request)
      if (!res.ok) throw new Error('Failed to rename')
      return (await res.json()) as unknown as InferResponseType<typeof $renameFile, 200>
    },
  })

  const $deleteFiles = client.api.files.$delete
  const { mutate: deleteFiles } = useMutation<void, Error, InferRequestType<typeof $deleteFiles>>({
    mutationFn: async (request) => {
      const res = await $deleteFiles(request)
      if (!res.ok) throw new Error('Failed to delete')
    },
  })

  const $deleteFolders = client.api.folders.$delete
  const { mutate: deleteFolders } = useMutation<
    InferResponseType<typeof $deleteFolders>,
    Error,
    InferRequestType<typeof $deleteFolders>
  >({
    mutationFn: async (request) => {
      const res = await $deleteFolders(request)
      if (!res.ok) throw new Error('Failed to delete')
      return null as unknown as InferResponseType<typeof $deleteFolders>
    },
  })

  const $restoreFiles = client.api.files.restore.$post
  const { mutate: restoreFiles } = useMutation<void, Error, InferRequestType<typeof $restoreFiles>>(
    {
      mutationFn: async (request) => {
        const res = await $restoreFiles(request)
        if (!res.ok) throw new Error('Failed to restore')
      },
    },
  )

  const $restoreFolders = client.api.folders.restore.$post
  const { mutate: restoreFolders } = useMutation<
    InferResponseType<typeof $restoreFolders>,
    Error,
    InferRequestType<typeof $restoreFolders>
  >({
    mutationFn: async (request) => {
      const res = await $restoreFolders(request)
      if (!res.ok) throw new Error('Failed to restore')
      return null as unknown as InferResponseType<typeof $restoreFolders>
    },
  })

  const handleRename = (item: AssetInfo) => {
    setEditingItemId(item.id!)
  }

  const confirmDelete = () => {
    const fileIds = itemsToDelete.filter((i) => i.type === 'file').map((i) => i.id!)
    const folderIds = itemsToDelete.filter((i) => i.type === 'folder').map((i) => i.id!)

    if (fileIds.length > 0) {
      deleteFiles(
        { json: { ids: fileIds } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: ['search', teamId, assetId],
            })
          },
        },
      )
    }

    if (folderIds.length > 0) {
      deleteFolders(
        { json: { ids: folderIds } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: ['search', teamId, assetId],
            })
          },
        },
      )
    }

    setIsDeleteDialogOpen(false)
    setItemsToDelete([])
  }

  const handleDelete = (items: AssetInfo[]) => {
    setItemsToDelete(items)
    setIsDeleteDialogOpen(true)
  }

  const handleRestore = (items: AssetInfo[]) => {
    const fileIds = items.filter((i) => i.type === 'file').map((i) => i.id!)
    const folderIds = items.filter((i) => i.type === 'folder').map((i) => i.id!)

    if (fileIds.length > 0) {
      restoreFiles(
        { json: { ids: fileIds } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: ['projects', projectId, 'recently-deleted', 'file'],
            })
          },
        },
      )
    }

    if (folderIds.length > 0) {
      restoreFolders(
        { json: { ids: folderIds } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: ['projects', projectId, 'recently-deleted', 'folder'],
            })
          },
        },
      )
    }
  }

  const handleDownload = (items: AssetInfo[]) => {
    alert(
      `Download functionality - Would download ${
        items.length
      } item(s): ${items.map((i) => i.name).join(', ')}`,
    )
  }

  const handleNewFolder = (name: string) => {
    createFolder(
      { json: { name, parentId: assetId } },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({
            queryKey: ['search', teamId],
          })
          queryClient.invalidateQueries({
            queryKey: ['folders', teamId],
          })
          if (data?.id) {
            setEditingItemId(data.id)
          }
        },
      },
    )
  }

  const onRenameSubmit = (item: AssetInfo, newName: string) => {
    if (item.type === 'folder') {
      renameFolder(
        { param: { folderId: item.id! }, json: { name: newName } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: ['search', teamId],
            })
            queryClient.invalidateQueries({
              queryKey: ['folders', teamId],
            })
          },
        },
      )
    } else {
      renameFile(
        {
          param: { fileId: item.id! },
          json: { name: newName },
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: ['search', teamId],
            })
            queryClient.invalidateQueries({
              queryKey: ['folders', teamId],
            })
          },
        },
      )
    }
  }

  const handleAction = (action: 'rename' | 'delete' | 'download' | 'restore', item: AssetInfo) => {
    const isSelected = selectedIds.has(item.id!)
    const targetItems = isSelected
      ? [...folders, ...files].filter((i) => selectedIds.has(i.id!))
      : [item]

    switch (action) {
      case 'rename':
        handleRename(item)
        break
      case 'delete':
        handleDelete(targetItems)
        break
      case 'download':
        handleDownload(targetItems)
        break
      case 'restore':
        handleRestore(targetItems)
        break
    }
  }

  return {
    editingItemId,
    setEditingItemId,
    handleRename,
    handleDelete,
    handleRestore,
    handleDownload,
    handleNewFolder,
    handleAction,
    onRenameSubmit,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    itemsToDelete,
    confirmDelete,
  }
}
