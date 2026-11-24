import { client } from '@/ui/api/client'
import { m } from '@/ui/paraglide/messages.js'
import type { ShareLinkInfo } from '@shumai/dtos'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

export interface ShareableAssetTarget {
  id?: string
  name: string
}

const EMPTY_SHARE_LINKS: ShareLinkInfo[] = []

interface UseShareLinkActionsOptions {
  projectId: string
  enabled?: boolean
}

export function useShareLinkActions({ projectId, enabled = true }: UseShareLinkActionsOptions) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [createdShareLink, setCreatedShareLink] = useState<ShareLinkInfo | null>(null)

  const { data: shareLinksData } = useQuery({
    queryKey: ['shares', projectId, 'list'],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].shares.$get({
        param: { projectId },
        query: { first: '100' },
      })
      if (!res.ok) throw new Error(m.failed_fetch_share_links())
      return (await res.json()) as unknown as { data: ShareLinkInfo[] }
    },
    enabled: !!projectId && enabled,
  })

  const { mutate: createShareLink, isPending: isCreatingShareLink } = useMutation({
    mutationFn: async (items: ShareableAssetTarget[]) => {
      const assetIds = items.map((i) => i.id).filter((id): id is string => Boolean(id))
      if (assetIds.length === 0) {
        throw new Error(m.failed_create_share_link())
      }

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
      if (!res.ok) throw new Error(m.failed_create_share_link())
      const share = (await res.json()) as unknown as ShareLinkInfo

      const assetsRes = await client.api.shares[':shareId'].assets.$post({
        param: { shareId: share.id },
        json: { assetIds },
      })
      if (!assetsRes.ok) throw new Error(m.failed_add_to_share_link())

      return share
    },
    onSuccess: (share) => {
      queryClient.invalidateQueries({ queryKey: ['shares', projectId] })
      setCreatedShareLink(share)
    },
    onError: () => {
      toast.error(m.failed_create_share_link())
    },
  })

  const { mutate: addToShareLink, isPending: isAddingToShareLink } = useMutation({
    mutationFn: async ({ shareId, items }: { shareId: string; items: ShareableAssetTarget[] }) => {
      const assetIds = items.map((i) => i.id).filter((id): id is string => Boolean(id))
      if (assetIds.length === 0) {
        throw new Error(m.failed_add_to_share_link())
      }

      const res = await client.api.shares[':shareId'].assets.$post({
        param: { shareId },
        json: { assetIds },
      })
      if (!res.ok) throw new Error(m.failed_add_to_share_link())
      return { shareId }
    },
    onSuccess: ({ shareId }) => {
      toast.success(m.added_to_share_link(), {
        action: {
          label: m.view(),
          onClick: () =>
            navigate({
              to: '/projects/$projectId/shares/$shareId',
              params: { projectId, shareId },
            }),
        },
      })
    },
    onError: () => {
      toast.error(m.failed_add_to_share_link())
    },
  })

  const clearCreatedShareLink = useCallback(() => {
    setCreatedShareLink(null)
  }, [])

  return {
    shareLinks: shareLinksData?.data ?? EMPTY_SHARE_LINKS,
    createShareLink,
    addToShareLink,
    isCreatingShareLink,
    isAddingToShareLink,
    isShareActionPending: isCreatingShareLink || isAddingToShareLink,
    createdShareLink,
    clearCreatedShareLink,
  }
}
