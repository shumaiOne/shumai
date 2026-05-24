import { client } from '@/ui/api/client'
import { useTeamContextStore } from '@/ui/stores/team-context'
import { useUiStore } from '@/ui/stores/ui'
import { useQuery } from '@tanstack/react-query'
import { useMatches, useNavigate, useParams, useRouterState, useSearch } from '@tanstack/react-router'
import { BreadcrumbNav } from './breadcrumb-nav'
import { ShumaiLogo } from '@/ui/components/ui/icons'
import type { AncestorFolder } from '@/dtos/asset'

export function TopNav() {
  const matches = useMatches()
  const { teamId } = useTeamContextStore()

  const currentRouteId = matches[matches.length - 1]?.routeId

  // Match exact team page: /teams/$teamId/
  const isTeamDashboard = teamId && currentRouteId === '/teams/$teamId/'

  if (isTeamDashboard) {
    return <TeamHeader />
  }

  // Ensure it's a project route but NOT the share management route
  if (
    currentRouteId === '/projects/$projectId/' ||
    currentRouteId === '/projects/$projectId/folders/$folderId' ||
    currentRouteId === '/projects/$projectId/files/$fileId' ||
    currentRouteId === '/projects/$projectId/recently-deleted'
  ) {
    return <ProjectTopNav />
  }

  return null
}

function TeamHeader() {
  return (
    <div className="flex h-14 flex-wrap items-center justify-center gap-2 border-b border-border bg-card px-4 py-2 flex-shrink-0">
      <ShumaiLogo className="w-10 h-10 text-orange-600" />
    </div>
  )
}

function ProjectTopNav() {
  const params = useParams({ strict: false }) as Record<string, string>
  const search = useSearch({ strict: false }) as Record<string, string>
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()

  const projectId = params.projectId
  const folderId = params.folderId
  const fileId = params.fileId
  const versionAssetId = search.version

  const { teamId } = useTeamContextStore()
  const uiStore = useUiStore()

  const isRecentlyDeleted = pathname.includes('/recently-deleted')
  const isFileView = !!fileId

  const { data: projectInfo } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].$get({
        param: { projectId: projectId! },
      })
      if (!res.ok) throw new Error('Failed to fetch project')
      return await res.json()
    },
    enabled: !!projectId,
  })

  const rootFolderId = projectInfo?.rootFolder
  const assetId = folderId || rootFolderId

  const { data: folderInfo } = useQuery({
    queryKey: ['folders', teamId, assetId],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].folders[':folderId'].$get({
        param: { teamId: teamId!, folderId: assetId! },
      })
      if (!res.ok) throw new Error('failed to fetch folder')
      return await res.json()
    },
    enabled: !!teamId && !!assetId && !isFileView && !isRecentlyDeleted,
  })

  const { data: fileData } = useQuery({
    queryKey: ['teams', teamId, 'files', fileId],
    queryFn: async () => {
      const res = await client.api.teams[':teamId'].files[':fileId'].$get({
        param: { teamId: teamId!, fileId: fileId! },
      })
      if (!res.ok) throw new Error('Failed to fetch stack')
      return await res.json()
    },
    enabled: !!teamId && !!fileId && isFileView,
  })

  const { data: versionsList } = useQuery({
    queryKey: ['projects', projectId, 'version_stacks', fileId, 'versions'],
    queryFn: async () => {
      const res = await client.api.projects[':projectId'].version_stacks[':stackId'].versions.$get({
        param: { projectId: projectId!, stackId: fileId! },
      })
      if (!res.ok) throw new Error('Failed to fetch versions')
      return await res.json()
    },
    enabled: !!projectId && !!fileId && !!versionAssetId && isFileView,
  })

  let ancestorFolders: AncestorFolder[] = []
  let currentAsset: { name?: string; type: 'file' | 'folder'; version?: number } = {
    name: '',
    type: 'folder',
  }
  let versions = undefined

  if (isRecentlyDeleted) {
    currentAsset = { name: 'Recently Deleted', type: 'folder' }
  } else if (isFileView && fileData) {
    ancestorFolders = fileData.ancestorFolders || []
    const versionsDataList = versionAssetId ? versionsList : fileData.versionStack?.versions
    currentAsset = {
      name: fileData.name,
      type: 'file',
      version: versionsDataList
        ? (versionsDataList.find((v: { id: string }) => v.id === (versionAssetId || fileId))?.version ??
          versionsDataList.length)
        : undefined,
    }
    versions = versionsDataList
  } else if (!isFileView && folderInfo) {
    ancestorFolders = folderInfo.ancestorFolders || []
    currentAsset = { name: folderInfo.name, type: 'folder' }
  }

  const isLeftSidebarCollapsed = isFileView
    ? uiStore.fileViewLeftSidebarCollapsed
    : uiStore.fileListLeftSidebarCollapsed
  const onLeftSidebarToggle = () =>
    isFileView
      ? uiStore.setFileViewLeftSidebarCollapsed(!uiStore.fileViewLeftSidebarCollapsed)
      : uiStore.setFileListLeftSidebarCollapsed(!uiStore.fileListLeftSidebarCollapsed)

  const isRightSidebarCollapsed = isFileView
    ? uiStore.fileViewRightSidebarCollapsed
    : uiStore.fileListRightSidebarCollapsed
  const onRightSidebarToggle = () =>
    isFileView
      ? uiStore.setFileViewRightSidebarCollapsed(!uiStore.fileViewRightSidebarCollapsed)
      : uiStore.setFileListRightSidebarCollapsed(!uiStore.fileListRightSidebarCollapsed)

  const displayStyle = projectId ? (uiStore.viewModes[projectId] ?? 'card') : 'card'
  const onDisplayStyleChange = (style: 'card' | 'list') => {
    if (projectId) uiStore.setViewMode(projectId, style)
  }

  const handleFolderClick = (id: string) => {
    navigate({
      to: '/projects/$projectId/folders/$folderId',
      params: { projectId: projectId!, folderId: id },
    })
  }

  if (!teamId || !projectId || !projectInfo) {
    return <div className="h-14 border-b border-border bg-card flex-shrink-0" />
  }

  return (
    <BreadcrumbNav
      teamId={teamId}
      projectId={projectId}
      projectName={projectInfo.name ?? ''}
      ancestorFolders={ancestorFolders}
      currentAsset={currentAsset}
      isRootFolder={!isFileView && !isRecentlyDeleted && assetId === rootFolderId}
      displayStyle={isFileView ? undefined : displayStyle}
      onDisplayStyleChange={isFileView ? undefined : onDisplayStyleChange}
      isLeftSidebarCollapsed={isLeftSidebarCollapsed}
      onLeftSidebarToggle={onLeftSidebarToggle}
      isRightSidebarCollapsed={isRightSidebarCollapsed}
      onRightSidebarToggle={onRightSidebarToggle}
      fileId={fileId}
      versions={versions}
      onFolderClick={handleFolderClick}
    />
  )
}
