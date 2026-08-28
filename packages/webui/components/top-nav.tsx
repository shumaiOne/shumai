import { useTopNavStore } from '@/ui/stores/top-nav'
import { BreadcrumbNav } from './breadcrumb-nav'
import { ShumaiLogo } from '@/ui/components/ui/icons'
import { useUiStore } from '@/ui/stores/ui'
import { useChatbotStore } from '@/ui/stores/chatbot'
import { useIsMobile } from '@/ui/hooks/use-mobile'

export function TopNav() {
  const { projectState } = useTopNavStore()
  const uiStore = useUiStore()
  const { isChatbotOpen, setIsChatbotOpen } = useChatbotStore()
  const isMobile = useIsMobile()

  if (isMobile && projectState?.fileId) {
    return null
  }

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
    customTerminalBreadcrumb,
    fileId,
    downloadInfo,
    versions,
    isPublic,
    shareId,
    allowDownload,
    onFolderClick,
    onRename,
    onDelete,
    compareMode,
    canCompareVersions,
    onCompareVersions,
  } = projectState

  const isFileView = !!fileId
  const isAgentsMd = !!customTerminalBreadcrumb

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

  const isRightSidebarCollapsed =
    isPublic && projectState.isRightSidebarCollapsed !== undefined
      ? projectState.isRightSidebarCollapsed
      : isFileView
        ? uiStore.fileViewRightSidebarCollapsed
        : isShareConfig
          ? uiStore.shareConfigRightSidebarCollapsed
          : uiStore.fileListRightSidebarCollapsed
  const onRightSidebarToggle =
    isPublic && projectState.onRightSidebarToggle
      ? projectState.onRightSidebarToggle
      : () => {
          if (!isPublic && isChatbotOpen) {
            setIsChatbotOpen(false)
            if (isFileView) {
              uiStore.setFileViewRightSidebarCollapsed(false)
            } else if (isShareConfig) {
              uiStore.setShareConfigRightSidebarCollapsed(false)
            } else {
              uiStore.setFileListRightSidebarCollapsed(false)
            }
          } else {
            if (isFileView) {
              uiStore.setFileViewRightSidebarCollapsed(!uiStore.fileViewRightSidebarCollapsed)
            } else if (isShareConfig) {
              uiStore.setShareConfigRightSidebarCollapsed(!uiStore.shareConfigRightSidebarCollapsed)
            } else {
              uiStore.setFileListRightSidebarCollapsed(!uiStore.fileListRightSidebarCollapsed)
            }
          }
        }

  const onChatbotToggle = isPublic
    ? undefined
    : () => {
        setIsChatbotOpen(!isChatbotOpen)
      }

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
      customTerminalBreadcrumb={customTerminalBreadcrumb}
      displayStyle={isFileView || isShareConfig || isAgentsMd ? undefined : displayStyle}
      onDisplayStyleChange={
        isFileView || isShareConfig || isAgentsMd ? undefined : onDisplayStyleChange
      }
      isLeftSidebarCollapsed={isLeftSidebarCollapsed}
      onLeftSidebarToggle={onLeftSidebarToggle}
      isRightSidebarCollapsed={isRightSidebarCollapsed}
      onRightSidebarToggle={onRightSidebarToggle}
      isChatbotOpen={!isPublic && isChatbotOpen}
      onChatbotToggle={onChatbotToggle}
      isPublic={isPublic}
      shareId={shareId}
      allowDownload={allowDownload}
      fileId={fileId}
      downloadInfo={downloadInfo}
      versions={versions}
      onFolderClick={onFolderClick}
      onRename={onRename}
      onDelete={onDelete}
      compareMode={compareMode}
      canCompareVersions={canCompareVersions}
      onCompareVersions={onCompareVersions}
    />
  )
}

import { Menu } from 'lucide-react'
import { Button } from '@/ui/components/ui/button'
import { useDualSidebarStore } from '@/ui/stores/dual-sidebar'

function TeamHeader() {
  const { toggleMobileMenu } = useDualSidebarStore()
  return (
    <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4 py-2 flex-shrink-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMobileMenu}
        className="md:hidden text-foreground hover:bg-accent -ml-2"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex flex-1 items-center justify-center">
        <ShumaiLogo className="w-10 h-10 text-orange-600" />
      </div>
      <div className="w-9 md:hidden" />
    </div>
  )
}
