import { useTopNavStore } from '@/ui/stores/top-nav'
import { BreadcrumbNav } from './breadcrumb-nav'
import { ShumaiLogo } from '@/ui/components/ui/icons'
import { useUiStore } from '@/ui/stores/ui'

export function TopNav() {
  const { projectState } = useTopNavStore()
  const uiStore = useUiStore()

  if (!projectState) {
    return <TeamHeader />
  }

  const {
    teamId,
    projectId,
    projectName,
    ancestorFolders,
    currentAsset,
    isRootFolder,
    fileId,
    versions,
    isPublic,
    shareId,
    onFolderClick,
  } = projectState

  const isFileView = !!fileId

  const isShareConfig = !!shareId && !isFileView

  const isLeftSidebarCollapsed = isFileView
    ? uiStore.fileViewLeftSidebarCollapsed
    : isShareConfig
      ? uiStore.shareConfigLeftSidebarCollapsed
      : uiStore.fileListLeftSidebarCollapsed
  const onLeftSidebarToggle = isPublic
    ? undefined
    : () =>
        isFileView
          ? uiStore.setFileViewLeftSidebarCollapsed(!uiStore.fileViewLeftSidebarCollapsed)
          : isShareConfig
            ? uiStore.setShareConfigLeftSidebarCollapsed(!uiStore.shareConfigLeftSidebarCollapsed)
            : uiStore.setFileListLeftSidebarCollapsed(!uiStore.fileListLeftSidebarCollapsed)

  const isRightSidebarCollapsed = isFileView
    ? uiStore.fileViewRightSidebarCollapsed
    : isShareConfig
      ? uiStore.shareConfigRightSidebarCollapsed
      : uiStore.fileListRightSidebarCollapsed
  const onRightSidebarToggle = () =>
    isFileView
      ? uiStore.setFileViewRightSidebarCollapsed(!uiStore.fileViewRightSidebarCollapsed)
      : isShareConfig
        ? uiStore.setShareConfigRightSidebarCollapsed(!uiStore.shareConfigRightSidebarCollapsed)
        : uiStore.setFileListRightSidebarCollapsed(!uiStore.fileListRightSidebarCollapsed)

  const displayStyle = projectId ? (uiStore.viewModes[projectId] ?? 'card') : 'card'
  const onDisplayStyleChange = isPublic
    ? undefined
    : (style: 'card' | 'list') => {
        if (projectId) uiStore.setViewMode(projectId, style)
      }

  return (
    <BreadcrumbNav
      teamId={teamId}
      projectId={projectId}
      projectName={projectName}
      ancestorFolders={ancestorFolders}
      currentAsset={currentAsset}
      isRootFolder={isRootFolder}
      displayStyle={isFileView ? undefined : displayStyle}
      onDisplayStyleChange={isFileView ? undefined : onDisplayStyleChange}
      isLeftSidebarCollapsed={isLeftSidebarCollapsed}
      onLeftSidebarToggle={onLeftSidebarToggle}
      isRightSidebarCollapsed={isRightSidebarCollapsed}
      onRightSidebarToggle={onRightSidebarToggle}
      isPublic={isPublic}
      shareId={shareId}
      fileId={fileId}
      versions={versions}
      onFolderClick={onFolderClick}
    />
  )
}

function TeamHeader() {
  return (
    <div className="flex h-14 flex-wrap items-center justify-center gap-2 border-b border-border bg-card px-4 py-2 flex-shrink-0">
      <ShumaiLogo className="w-10 h-10 text-orange-600" />
    </div>
  )
}
