'use client'

import { client } from '@/ui/api/client'
import { useTopNavStore } from '@/ui/stores/top-nav'
import { m } from '@/ui/paraglide/messages.js'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useState, useMemo, useRef } from 'react'
import { TopNav } from './top-nav'
import { FileBrowser } from './file-browser/file-browser'
import { FileViewerRightSidebar } from './file-viewer-right-sidebar'
import { ResizeHandle } from './resize-handle'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Lock, AlertCircle, Loader2 } from 'lucide-react'
import type { AncestorFolder, AssetInfoPaginatedList, AssetInfo, CommentInfo } from '@shumai/dtos'
import { FieldInfo } from '@shumai/dtos'
import { FileViewer } from './file-viewer'
import { CompareViewer } from './compare/compare-viewer'
import { pickDefaultCompareVersions } from './compare/compare-utils'
import type { MediaController } from './viewers/types'
import type { Annotation } from '@/ui/types'

import { useNavigate } from '@tanstack/react-router'

interface PublicShareManagerProps {
  shareId: string
  initialFolderId?: string
  initialFileId?: string
  startTime?: number
  versionId?: string
  compare?: boolean
  compareLeftId?: string
  compareRightId?: string
  compareActiveSide?: 'left' | 'right'
}

interface PublicShareInfo {
  id: string
  name: string
  expireAt: string | null
  isDisabled: boolean
  isExpired: boolean
  hasPassword: boolean
  rootFolderId: string
  projectId: string
  viewMode?: string | null
  defaultSortOrder?: string | null
}

export function PublicShareManager({
  shareId,
  initialFolderId,
  initialFileId,
  startTime,
  versionId,
  compare,
  compareLeftId,
  compareRightId,
  compareActiveSide = 'left',
}: PublicShareManagerProps) {
  const navigate = useNavigate()
  const isCompareMode = !!compare && !!compareLeftId && !!compareRightId
  const [password, setPassword] = useState(() => {
    return localStorage.getItem(`share_pwd_${shareId}`) || ''
  })
  const [passwordInput, setPasswordInput] = useState('')

  const {
    data: shareInfo,
    error: shareInfoError,
    isLoading: isShareInfoLoading,
  } = useQuery<PublicShareInfo>({
    queryKey: ['share-info', shareId, password],
    queryFn: async () => {
      const res = await client.api.shares[':shareId'].info.$get(
        {
          param: { shareId },
        },
        {
          headers: {
            'x-share-password': password,
          },
        },
      )
      if (res.status === 401) {
        throw new Error('Unauthorized')
      }
      if (res.status === 403) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error || 'Forbidden')
      }
      if (!res.ok) {
        throw new Error('Failed to fetch share info')
      }
      return (await res.json()) as unknown as PublicShareInfo
    },
    retry: false,
  })

  const currentFolderId = initialFolderId || shareInfo?.rootFolderId
  const viewingFileId = initialFileId || null
  // The stack asset is always fetched by the route file id; when a version is
  // selected we additionally display that version child asset.
  const activeFileId = versionId || viewingFileId

  const [ancestorFolders, setAncestorFolders] = useState<AncestorFolder[]>([])

  // Fetch ancestors for breadcrumb
  const { data: folderInfo } = useQuery({
    queryKey: ['public-share-folder', shareId, currentFolderId, password],
    queryFn: async () => {
      const res = await client.api.shares[':shareId'].files[':fileId'].$get(
        {
          param: { shareId, fileId: currentFolderId! },
        },
        {
          headers: {
            'x-share-password': password,
          },
        },
      )
      if (res.status === 401) throw new Error('Unauthorized')
      return (await res.json()) as unknown as AssetInfo
    },
    enabled: !!shareInfo && !!currentFolderId,
  })

  useEffect(() => {
    if (folderInfo?.ancestorFolders && shareInfo) {
      // Filter ancestors to only those within the share root
      const rootIndex = folderInfo.ancestorFolders.findIndex((f) => f.id === shareInfo.rootFolderId)
      if (rootIndex !== -1) {
        setAncestorFolders(folderInfo.ancestorFolders.slice(0, rootIndex))
      } else if (currentFolderId === shareInfo.rootFolderId) {
        setAncestorFolders([])
      }
    }
  }, [folderInfo, shareInfo, currentFolderId])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [rightSidebarWidth, setRightSidebarWidth] = useState(360)
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(() => !initialFileId)
  const mediaControllerRef = useRef<MediaController | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)
  const [compareActiveAsset, setCompareActiveAsset] = useState<AssetInfo | null>(null)
  const [seekRequest, setSeekRequest] = useState<{ second: number; nonce: number } | undefined>(
    undefined,
  )

  const {
    data: foldersData,
    fetchNextPage: fetchNextFoldersPage,
    hasNextPage: hasNextPageFolders,
    isFetchingNextPage: isFetchingNextFoldersPage,
    error: foldersError,
  } = useInfiniteQuery<AssetInfoPaginatedList>({
    queryKey: ['public-share-children', shareId, currentFolderId, 'folder', password],
    queryFn: async ({ pageParam }) => {
      const res = await client.api.shares[':shareId'].folders[':folderId'].children.$get(
        {
          param: { shareId, folderId: currentFolderId! },
          query: {
            assetType: 'folder',
            after: pageParam as string,
          },
        },
        {
          headers: {
            'x-share-password': password,
          },
        },
      )
      if (res.status === 401) throw new Error('Unauthorized')
      if (res.status === 403) throw new Error('Expired')
      return (await res.json()) as unknown as AssetInfoPaginatedList
    },
    enabled: !!shareInfo && !!currentFolderId,
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pageInfo?.cursor || undefined,
    retry: false,
  })

  const {
    data: filesData,
    fetchNextPage: fetchNextFilesPage,
    hasNextPage: hasNextPageFiles,
    isFetchingNextPage: isFetchingNextFilesPage,
  } = useInfiniteQuery<AssetInfoPaginatedList>({
    queryKey: ['public-share-children', shareId, currentFolderId, 'file', password],
    queryFn: async ({ pageParam }) => {
      const res = await client.api.shares[':shareId'].folders[':folderId'].children.$get(
        {
          param: { shareId, folderId: currentFolderId! },
          query: {
            assetType: 'file',
            after: pageParam as string,
          },
        },
        {
          headers: {
            'x-share-password': password,
          },
        },
      )
      if (res.status === 401) throw new Error('Unauthorized')
      if (res.status === 403) throw new Error('Expired')
      return (await res.json()) as unknown as AssetInfoPaginatedList
    },
    enabled: !!shareInfo && !!currentFolderId,
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pageInfo?.cursor || undefined,
    retry: false,
  })

  const { data: publicFields } = useQuery({
    queryKey: ['public-share-fields', shareId, password],
    queryFn: async () => {
      const res = await client.api.shares[':shareId'].fields.$get(
        {
          param: { shareId },
        },
        {
          headers: {
            'x-share-password': password,
          },
        },
      )
      if (res.status === 401) throw new Error('Unauthorized')
      return (await res.json()) as unknown as FieldInfo[]
    },
    enabled: !!shareInfo,
  })

  const { data: stackFileData, isLoading: isStackFileLoading } = useQuery({
    queryKey: ['public-share-file', shareId, viewingFileId, password],
    queryFn: async () => {
      const res = await client.api.shares[':shareId'].files[':fileId'].$get(
        {
          param: { shareId, fileId: viewingFileId! },
        },
        {
          headers: {
            'x-share-password': password,
          },
        },
      )
      if (res.status === 401) throw new Error('Unauthorized')
      return (await res.json()) as unknown as AssetInfo
    },
    enabled: !!viewingFileId && !!shareInfo,
  })

  const { data: versionFileData, isLoading: isVersionFileLoading } = useQuery({
    queryKey: ['public-share-file', shareId, versionId, password],
    queryFn: async () => {
      const res = await client.api.shares[':shareId'].files[':fileId'].$get(
        {
          param: { shareId, fileId: versionId! },
        },
        {
          headers: {
            'x-share-password': password,
          },
        },
      )
      if (res.status === 401) throw new Error('Unauthorized')
      return (await res.json()) as unknown as AssetInfo
    },
    enabled: !!versionId && !!shareInfo,
  })

  // The stack asset provides the version list; the active asset (version child
  // or the stack itself) is what we actually display.
  const viewingFileData = versionId ? versionFileData : stackFileData
  const isViewingFileLoading = isStackFileLoading || (!!versionId && isVersionFileLoading)

  useEffect(() => {
    if (foldersError?.message === 'Unauthorized') {
      setPassword('')
      localStorage.removeItem(`share_pwd_${shareId}`)
    }
  }, [foldersError, shareId])

  const folders = useMemo(
    () => foldersData?.pages.flatMap((page) => page.data ?? []) ?? [],
    [foldersData],
  )
  const files = useMemo(
    () => filesData?.pages.flatMap((page) => page.data ?? []) ?? [],
    [filesData],
  )

  const currentSelectedItem = useMemo(() => {
    if (viewingFileData) return viewingFileData
    if (selectedIds.size !== 1) return null
    const id = Array.from(selectedIds)[0]
    return [...folders, ...files].find((item) => item.id === id) || null
  }, [selectedIds, folders, files, viewingFileData])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPassword(passwordInput)
    localStorage.setItem(`share_pwd_${shareId}`, passwordInput)
  }

  const handleItemDoubleClick = (item: AssetInfo) => {
    if (item.type === 'folder' || item.targetType === 'folder') {
      navigate({
        to: '/share/$shareId/folders/$folderId',
        params: { shareId, folderId: item.id! },
      })
    } else {
      navigate({
        to: '/share/$shareId/files/$fileId',
        params: {
          shareId,
          fileId: item.versionStack ? item.versionStack.id : item.id!,
        },
      })
    }
    setSelectedIds(new Set())
  }

  const handleBreadcrumbClick = (folderId: string) => {
    if (!shareInfo) return
    const targetId = folderId === 'root' ? shareInfo.rootFolderId : folderId

    if (targetId === shareInfo.rootFolderId) {
      navigate({
        to: '/share/$shareId',
        params: { shareId },
      })
    } else {
      navigate({
        to: '/share/$shareId/folders/$folderId',
        params: { shareId, folderId: targetId },
      })
    }
    setSelectedIds(new Set())
  }

  const handleCommentSelect = (comment: CommentInfo) => {
    setSelectedCommentId(comment.id || null)
    const newAnnotations = comment.annotations as Annotation[]
    if (newAnnotations && newAnnotations.length > 0) {
      setAnnotations(newAnnotations)
    } else {
      setAnnotations([])
    }

    if (isCompareMode) {
      if (comment.second !== null && comment.second !== undefined) {
        setSeekRequest({ second: comment.second, nonce: Date.now() })
      }
      return
    }

    if (comment.second !== null && comment.second !== undefined) {
      mediaControllerRef.current?.seekTo(comment.second)
      mediaControllerRef.current?.pause()
    } else if (newAnnotations && newAnnotations.length > 0) {
      mediaControllerRef.current?.pause()
    }
  }

  const handlePlay = () => {
    setAnnotations([])
    setSelectedCommentId(null)
  }

  const updateCompareSearch = (patch: Record<string, unknown>) => {
    if (!viewingFileId) return
    navigate({
      to: '/share/$shareId/files/$fileId',
      params: { shareId, fileId: viewingFileId },
      search: (p: Record<string, unknown>) => ({ ...p, ...patch }),
    })
  }

  const handleCompareExit = () => {
    const activeId = compareActiveSide === 'left' ? compareLeftId : compareRightId
    updateCompareSearch({
      compare: undefined,
      cmpLeft: undefined,
      cmpRight: undefined,
      cmpActive: undefined,
      version: activeId,
    })
  }

  const { setProjectState, clearProjectState } = useTopNavStore()

  useEffect(() => {
    if (shareInfo && currentFolderId) {
      const currentFolderName =
        currentFolderId === shareInfo.rootFolderId
          ? shareInfo.name
          : folders.find((f) => f.id === currentFolderId)?.name || shareInfo.name

      setProjectState({
        teamId: '', // Public view doesn't have team context
        projectId: shareInfo.projectId,
        projectName: shareInfo.name,
        ancestorFolders: ancestorFolders,
        currentAsset: {
          name: viewingFileData?.name || currentFolderName,
          type: viewingFileId ? 'file' : 'folder',
          version: stackFileData?.versionStack
            ? (stackFileData.versionStack.versions.find((v) => v.id === activeFileId)?.version ??
              stackFileData.versionStack.versions.length)
            : undefined,
          mediaType: viewingFileData?.mediaType || null,
        },
        isRootFolder: currentFolderId === shareInfo.rootFolderId && !viewingFileId,
        isPublic: true,
        shareId,
        fileId: viewingFileId || undefined,
        downloadInfo: viewingFileData
          ? {
              originalKey: viewingFileData.media?.original?.key,
              videoTranscodes: viewingFileData.media?.videoTranscodes?.map((t) => ({
                key: t.key,
                width: t.width,
                height: t.height,
                isRaw: t.isRaw,
              })),
            }
          : undefined,
        onFolderClick: handleBreadcrumbClick,
        isRightSidebarCollapsed,
        onRightSidebarToggle: () => setIsRightSidebarCollapsed((prev) => !prev),
        versions: stackFileData?.versionStack?.versions,
        compareMode: isCompareMode,
        canCompareVersions: (stackFileData?.versionStack?.versions?.length ?? 0) >= 2,
        onCompareVersions: () => {
          const pair = pickDefaultCompareVersions(stackFileData?.versionStack?.versions)
          if (!pair || !viewingFileId) return
          navigate({
            to: '/share/$shareId/files/$fileId',
            params: { shareId, fileId: viewingFileId },
            search: (p: Record<string, unknown>) => ({
              ...p,
              compare: true,
              cmpLeft: pair.left.id,
              cmpRight: pair.right.id,
              cmpActive: 'left' as const,
            }),
          })
        },
      })
    }

    return () => clearProjectState()
  }, [
    shareInfo,
    currentFolderId,
    folders,
    viewingFileData,
    stackFileData,
    activeFileId,
    viewingFileId,
    ancestorFolders,
    setProjectState,
    clearProjectState,
    isRightSidebarCollapsed,
    isCompareMode,
    navigate,
    shareId,
  ])

  let content

  if (isShareInfoLoading && !shareInfoError) {
    content = (
      <div className="flex flex-1 items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    )
  } else if (shareInfoError) {
    if (shareInfoError.message === 'Unauthorized') {
      const isPasswordWrong = password !== ''
      content = (
        <div className="flex flex-1 items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>{m.password_protected()}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    autoFocus
                  />
                  {isPasswordWrong && (
                    <p className="text-sm font-medium text-destructive">
                      Incorrect password. Please try again.
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full">
                  Access Share
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )
    } else {
      const isExpired = shareInfoError.message.includes('expired')
      const isDisabled = shareInfoError.message.includes('disabled')
      content = (
        <div className="flex flex-1 items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>
                {isExpired ? 'Share Expired' : isDisabled ? 'Share Disabled' : 'Error'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center text-muted-foreground">
              {shareInfoError.message}
            </CardContent>
          </Card>
        </div>
      )
    }
  } else if (!shareInfo) {
    content = (
      <div className="flex flex-1 items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    )
  } else {
    content = (
      <div className="flex flex-1 overflow-hidden relative">
        {viewingFileId ? (
          <div className="flex-1 relative bg-muted/30">
            {isViewingFileLoading && !isCompareMode && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
                <Loader2 className="h-8 w-8 animate-spin text-foreground" />
              </div>
            )}
            {isCompareMode && compareLeftId && compareRightId ? (
              <CompareViewer
                isPublic
                shareId={shareId}
                versions={viewingFileData?.versionStack?.versions ?? []}
                leftId={compareLeftId}
                rightId={compareRightId}
                activeSide={compareActiveSide}
                annotations={annotations}
                seekRequest={seekRequest}
                onActiveSideChange={(side) => updateCompareSearch({ cmpActive: side })}
                onSwitchVersion={(side, versionId) =>
                  updateCompareSearch(
                    side === 'left' ? { cmpLeft: versionId } : { cmpRight: versionId },
                  )
                }
                onExit={handleCompareExit}
                onActiveAssetChange={setCompareActiveAsset}
                onPlay={handlePlay}
                onTimeUpdate={setCurrentTime}
              />
            ) : (
              viewingFileData && (
                <FileViewer
                  file={viewingFileData}
                  mediaControllerRef={mediaControllerRef}
                  onPlay={handlePlay}
                  onTimeUpdate={setCurrentTime}
                  annotations={annotations}
                  startTime={startTime}
                  shareId={shareId}
                />
              )
            )}
          </div>
        ) : (
          currentFolderId && (
            <FileBrowser
              teamId=""
              projectId={shareInfo.projectId}
              assetId={currentFolderId}
              folders={folders}
              files={files}
              selectedItem={null}
              selectedIds={selectedIds}
              onItemSelect={(item, e) => {
                if (e.metaKey || e.ctrlKey) {
                  const next = new Set(selectedIds)
                  if (next.has(item.id!)) next.delete(item.id!)
                  else next.add(item.id!)
                  setSelectedIds(next)
                } else {
                  setSelectedIds(new Set([item.id!]))
                }
              }}
              onItemDoubleClick={handleItemDoubleClick}
              onSaveField={() => {}}
              displayStyle={(shareInfo.viewMode as 'card' | 'list') ?? 'card'}
              onClearSelection={() => setSelectedIds(new Set())}
              fetchNextFoldersPage={fetchNextFoldersPage}
              hasNextFoldersPage={hasNextPageFolders}
              isFetchingNextFoldersPage={isFetchingNextFoldersPage}
              fetchNextFilesPage={fetchNextFilesPage}
              hasNextFilesPage={hasNextPageFiles}
              isFetchingNextFilesPage={isFetchingNextFilesPage}
              isShareView={true}
              isPublic={true}
            />
          )
        )}

        {!isRightSidebarCollapsed && (
          <>
            <ResizeHandle
              onResize={(delta) =>
                setRightSidebarWidth((p) => Math.max(240, Math.min(600, p - delta)))
              }
            />
            <div style={{ width: rightSidebarWidth }} className="flex-shrink-0 border-l">
              <FileViewerRightSidebar
                teamId=""
                projectId={shareInfo.projectId}
                file={isCompareMode ? compareActiveAsset : currentSelectedItem}
                onSaveField={() => {}}
                members={[]}
                readOnly={true}
                publicFields={publicFields}
                onCommentSelect={handleCommentSelect}
                isPublic={true}
                shareId={shareId}
                currentTime={currentTime}
                onTyping={() => {
                  mediaControllerRef.current?.pause()
                }}
                selectedCommentId={selectedCommentId}
              />
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopNav />
      {content}
    </div>
  )
}
