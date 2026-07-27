'use client'

import { client } from '@/ui/api/client'
import type { AssetInfo } from '@shumai/dtos'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InferRequestType, InferResponseType } from 'hono/client'
import { useState } from 'react'
import { toast } from 'sonner'
import { copyToClipboard } from '@/ui/lib/clipboard'
import { m } from '@/ui/paraglide/messages.js'

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
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false)
  const [isLoadingLinks, setIsLoadingLinks] = useState(false)
  const [resolvedFiles, setResolvedFiles] = useState<
    Array<{ id: string; name: string; url: string }>
  >([])
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

  const $getDownloadLinks = client.api.files['download-links'].$post
  const { mutateAsync: getDownloadLinks } = useMutation<
    InferResponseType<typeof $getDownloadLinks, 200>,
    Error,
    InferRequestType<typeof $getDownloadLinks>
  >({
    mutationFn: async (request) => {
      const res = await $getDownloadLinks(request)
      if (!res.ok) throw new Error('Failed to get download links')
      return (await res.json()) as unknown as InferResponseType<typeof $getDownloadLinks, 200>
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
            queryClient.invalidateQueries({
              queryKey: ['folders'],
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

  const handleDownload = async (items: AssetInfo[]) => {
    if (items.length === 0) return
    setIsDownloadDialogOpen(true)
    setIsLoadingLinks(true)
    setResolvedFiles([])
    try {
      const res = await getDownloadLinks({
        json: { ids: items.map((i) => i.id!) },
      })
      setResolvedFiles(res.files)
    } catch (error) {
      toast.error('Failed to prepare download links')
      setIsDownloadDialogOpen(false)
      console.error(error)
    } finally {
      setIsLoadingLinks(false)
    }
  }

  const handleCopyNameAndDownloadLink = async (items: AssetInfo[]) => {
    if (items.length === 0) return
    try {
      const res = await getDownloadLinks({
        json: { ids: items.map((i) => i.id!) },
      })
      const files = res.files
      if (files.length === 0) return

      let text = ''
      if (files.length === 1) {
        text = `Name: ${files[0].name}\nPath: ${files[0].url}`
      } else {
        text = files.map((f) => `${f.name}\t${f.url}`).join('\n')
      }

      const ok = await copyToClipboard(text)
      if (ok) {
        toast.success(m.copied_name_and_download_link_to_clipboard())
      }
    } catch (error) {
      toast.error('Failed to copy name and download link')
      console.error(error)
    }
  }

  const startDownload = () => {
    const files = [...resolvedFiles]
    setIsDownloadDialogOpen(false)

    if (files.length === 0) return

    toast.info(
      `Starting download of ${files.length} files. Please allow multiple downloads if prompted by your browser.`,
      {
        duration: 5000,
      },
    )

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    const runQueue = async () => {
      const batchSize = 5
      for (let i = 0; i < files.length; i += batchSize) {
        const chunk = files.slice(i, i + batchSize)
        for (const file of chunk) {
          const a = document.createElement('a')
          a.href = file.url
          a.download = file.name
          a.target = '_blank'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        }
        if (i + batchSize < files.length) {
          await delay(600)
        }
      }
      toast.success('All downloads initiated successfully')
    }

    runQueue().catch((err) => {
      console.error('Background downloads failed:', err)
      toast.error('Some downloads could not be started')
    })
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
            queryKey: ['folders'],
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
              queryKey: ['folders'],
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
              queryKey: ['folders'],
            })
          },
        },
      )
    }
  }

  const handleAction = (
    action: 'rename' | 'delete' | 'download' | 'restore' | 'copy-name-and-download-link',
    item: AssetInfo,
  ) => {
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
      case 'copy-name-and-download-link':
        handleCopyNameAndDownloadLink(targetItems)
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
    handleCopyNameAndDownloadLink,
    handleNewFolder,
    handleAction,
    onRenameSubmit,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    itemsToDelete,
    confirmDelete,
    isDownloadDialogOpen,
    setIsDownloadDialogOpen,
    isLoadingLinks,
    resolvedFiles,
    startDownload,
  }
}
