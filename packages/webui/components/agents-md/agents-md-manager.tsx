import { client } from '@/ui/api/client'
import { ChatbotSidebar } from '@/ui/components/chatbot-sidebar'
import { FolderTree } from '@/ui/components/folder-tree'
import { ResizeHandle } from '@/ui/components/resize-handle'
import { useChatbotStore } from '@/ui/stores/chatbot'
import { useTopNavStore } from '@/ui/stores/top-nav'
import { useUiStore } from '@/ui/stores/ui'
import type { AssetInfo } from '@shumai/dtos'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AgentsMdEditor } from './agents-md-editor'

export interface AgentsMdManagerProps {
  teamId: string
  projectId: string
  projectName: string
  assetId: string
  rootFolderId: string
  isRoot?: boolean
}

export default function AgentsMdManager({
  teamId,
  projectId,
  projectName,
  assetId,
  rootFolderId,
  isRoot,
}: AgentsMdManagerProps) {
  const navigate = useNavigate()
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(240)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(360)
  const {
    fileListLeftSidebarCollapsed: isLeftSidebarCollapsed,
    setFileListLeftSidebarCollapsed: setIsLeftSidebarCollapsed,
  } = useUiStore()
  const { isChatbotOpen, setIsChatbotOpen } = useChatbotStore()

  const { data: folderInfo } = useQuery({
    queryKey: ['folders', assetId],
    queryFn: async () => {
      const res = await client.api.folders[':folderId'].$get({
        param: { folderId: assetId },
      })
      if (!res.ok) throw new Error('failed to fetch folder')
      return (await res.json()) as unknown as AssetInfo
    },
    enabled: !!assetId,
  })

  const { setProjectState, clearProjectState } = useTopNavStore()

  useEffect(() => {
    setProjectState({
      teamId,
      projectId,
      projectName,
      ancestorFolders: folderInfo?.ancestorFolders ?? [],
      currentAsset: { name: folderInfo?.name, type: 'folder' },
      isRootFolder: isRoot || assetId === rootFolderId,
      onFolderClick: (id: string) => {
        navigate({
          to: '/projects/$projectId/folders/$folderId',
          params: { projectId, folderId: id },
        })
      },
    })

    return () => clearProjectState()
  }, [
    teamId,
    projectId,
    projectName,
    folderInfo?.ancestorFolders,
    folderInfo?.name,
    isRoot,
    assetId,
    rootFolderId,
    setProjectState,
    clearProjectState,
    navigate,
  ])

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-1 flex overflow-hidden relative">
        {!isLeftSidebarCollapsed && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsLeftSidebarCollapsed(true)}
          />
        )}
        {isChatbotOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsChatbotOpen(false)}
          />
        )}

        {!isLeftSidebarCollapsed && (
          <>
            <div className="bg-background flex-shrink-0" style={{ width: leftSidebarWidth }}>
              <FolderTree
                teamId={teamId}
                projectId={projectId}
                projectName={projectName}
                rootFolderId={rootFolderId}
                selectedFolderId={assetId}
                ancestorFolders={folderInfo?.ancestorFolders ?? []}
              />
            </div>
            <ResizeHandle
              onResize={(delta) => {
                setLeftSidebarWidth((prev) => Math.max(180, Math.min(400, prev + delta)))
              }}
              className="hidden md:block"
            />
          </>
        )}

        <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden p-3">
          <AgentsMdEditor
            teamId={teamId}
            projectId={projectId}
            assetId={assetId}
            rootFolderId={rootFolderId}
            isRoot={isRoot}
          />
        </div>

        {isChatbotOpen && (
          <>
            <ResizeHandle
              onResize={(delta) => {
                setRightSidebarWidth((prev) => Math.max(240, Math.min(600, prev - delta)))
              }}
              className="hidden md:block"
            />
            <div
              style={{ width: rightSidebarWidth }}
              className="bg-background flex flex-col flex-shrink-0"
            >
              <ChatbotSidebar projectId={projectId} contextAssetId={assetId} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
