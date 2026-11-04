'use client'

import { client } from '@/ui/api/client'
import type { AssetInfo } from '@shumai/dtos'
import { toast } from 'sonner'
import { copyToClipboard, copyToClipboardDeferred, copyImageToClipboard } from '@/ui/lib/clipboard'
import { type CopyKind, formatCopyText, pickClipboardTranscode } from './copy-options'
import { m } from '@/ui/paraglide/messages.js'

export interface UseCopyActionsProps {
  projectId?: string
  isPublic?: boolean
  shareId?: string
  getDownloadLinks: (args: { json: { ids: string[] } }) => Promise<{
    files: Array<{ id: string; name: string; url: string }>
    skippedArchivedCount?: number
  }>
}

export function useCopyActions({
  projectId,
  isPublic,
  shareId,
  getDownloadLinks,
}: UseCopyActionsProps) {
  const handleCopy = async (kind: CopyKind, items: AssetInfo[]) => {
    if (items.length === 0) return

    if (kind === 'image') {
      const item = items[0]
      const transcode = pickClipboardTranscode(item.media?.imageTranscodes)

      if (!transcode && !item.preview?.thumbnailUrl && item.status !== 'processed') {
        toast.error(m.copy_image_failed())
        return
      }

      const fetchImageUrl = async (): Promise<string> => {
        if (transcode?.url) return transcode.url
        if (transcode?.key && item.id) {
          if (isPublic && shareId) {
            const password = localStorage.getItem(`share_pwd_${shareId}`) || ''
            const res = await client.api.shares[':shareId'].files[':fileId']['download-url'].$post(
              {
                param: { shareId, fileId: item.id },
                json: { key: transcode.key },
              },
              {
                headers: {
                  'x-share-password': password,
                },
              },
            )
            if (res.ok) {
              const { url } = await res.json()
              return url
            }
          } else {
            const res = await client.api.files['download-url'].$post({
              json: { key: transcode.key, assetId: item.id },
            })
            if (res.ok) {
              const { url } = await res.json()
              return url
            }
          }
        }
        if (item.preview?.thumbnailUrl) {
          return item.preview.thumbnailUrl
        }
        throw new Error('No image URL available')
      }

      try {
        const ok = await copyImageToClipboard(fetchImageUrl())
        if (ok) {
          toast.success(m.copied_image_toast())
        } else {
          toast.error(m.copy_image_failed())
        }
      } catch {
        toast.error(m.copy_image_failed())
      }
      return
    }

    if (kind === 'download-link') {
      const targetFiles = items.filter((i) => i.type !== 'folder')
      if (targetFiles.length === 0) return

      let hasShownEmptyError = false
      try {
        const fetchDownloadLinksPromise = (async () => {
          const res = await getDownloadLinks({
            json: { ids: targetFiles.map((i) => i.id!) },
          })
          const files = res.files
          if (files.length === 0) {
            hasShownEmptyError = true
            if ((res.skippedArchivedCount ?? 0) > 0) {
              toast.error(m.download_all_archived_error())
            } else {
              toast.error(m.copy_failed())
            }
            throw new Error('NO_FILES_TO_COPY')
          }
          return files.map((f) => f.url).join('\n')
        })()

        const ok = await copyToClipboardDeferred(fetchDownloadLinksPromise)
        if (ok) {
          const skippedFolders = items.length - targetFiles.length
          if (targetFiles.length === 1 && skippedFolders === 0) {
            toast.success(m.copied_download_link_toast())
          } else {
            const baseToast = m.copied_download_links_toast({ count: targetFiles.length })
            const msg =
              skippedFolders > 0
                ? `${baseToast} ${m.copied_skipped_folders_suffix({ count: skippedFolders })}`
                : baseToast
            toast.success(msg)
          }
        } else if (!hasShownEmptyError) {
          toast.error(m.copy_failed())
        }
      } catch (err) {
        if (!hasShownEmptyError) {
          console.error('Failed to copy download links:', err)
          toast.error(m.copy_failed())
        }
      }
      return
    }

    if (kind === 'storage-path') {
      const targetFiles = items.filter((i) => i.type !== 'folder')
      if (targetFiles.length === 0) return

      let hasShownEmptyError = false
      try {
        const fetchStoragePathsPromise = (async () => {
          const res = await client.api.files['storage-paths'].$post({
            json: { ids: targetFiles.map((i) => i.id!) },
          })
          if (!res.ok) throw new Error('Failed to fetch storage paths')
          const data = await res.json()
          if (!data.paths || data.paths.length === 0) {
            hasShownEmptyError = true
            toast.error(m.copy_failed())
            throw new Error('NO_PATHS_TO_COPY')
          }
          return data.paths.map((p) => p.path).join('\n')
        })()

        const ok = await copyToClipboardDeferred(fetchStoragePathsPromise)
        if (ok) {
          const skippedFolders = items.length - targetFiles.length
          if (targetFiles.length === 1 && skippedFolders === 0) {
            toast.success(m.copied_storage_path_toast())
          } else {
            const baseToast = m.copied_storage_paths_toast({ count: targetFiles.length })
            const msg =
              skippedFolders > 0
                ? `${baseToast} ${m.copied_skipped_folders_suffix({ count: skippedFolders })}`
                : baseToast
            toast.success(msg)
          }
        } else if (!hasShownEmptyError) {
          toast.error(m.copy_failed())
        }
      } catch (err) {
        if (!hasShownEmptyError) {
          console.error('Failed to copy storage paths:', err)
          toast.error(m.copy_failed())
        }
      }
      return
    }

    // Synchronous text copy
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const text = formatCopyText(kind, items, { origin, projectId })
    const ok = await copyToClipboard(text)

    if (ok) {
      switch (kind) {
        case 'name':
          toast.success(
            items.length === 1
              ? m.copied_name_toast()
              : m.copied_names_toast({ count: items.length }),
          )
          break
        case 'link':
          toast.success(
            items.length === 1
              ? m.copied_link_toast()
              : m.copied_links_toast({ count: items.length }),
          )
          break
        case 'id':
          toast.success(
            items.length === 1 ? m.copied_id_toast() : m.copied_ids_toast({ count: items.length }),
          )
          break
        case 'markdown':
          toast.success(
            items.length === 1
              ? m.copied_markdown_link_toast()
              : m.copied_markdown_links_toast({ count: items.length }),
          )
          break
        case 'tsv':
          toast.success(m.copied_table_toast({ count: items.length }))
          break
      }
    } else {
      toast.error(m.copy_failed())
    }
  }

  return { handleCopy }
}
