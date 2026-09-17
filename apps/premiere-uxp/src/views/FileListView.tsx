import React, { useEffect, useState, useCallback } from 'react'
import { getShumaiClient } from '../api/client'
import { Breadcrumb, BreadcrumbCrumb } from '../components/Breadcrumb'
import { FileCardItem, AssetSummary } from '../components/FileItem'
import { ImportVideoDialog } from '../components/ImportVideoDialog'
import { LinkSequenceDialog } from '../components/LinkSequenceDialog'
import {
  getAllSequenceLinksFromCache,
  getAllLinkedSequences,
  normalizeGuid,
  removeSequenceLink,
  removeSequenceLinkFromCache,
} from '../services/linkStorage'
import { getActiveProject, getAllSequences } from '../services/premiere'
import type { LinkedSequenceAsset } from '../types/link'
import { importAssetIntoPremiere, type ProxyOption } from '../services/import'
import { ProjectSummary } from './ProjectsView'
import { isSameEndpoint } from '../utils/url'
import { ActionButton } from '@swc-react/action-button'
import { Button } from '@swc-react/button'
import { Search } from '@swc-react/search'
import { ProgressCircle } from '@swc-react/progress-circle'
import { StatusLight } from '@swc-react/status-light'
import { IllustratedMessage } from '@swc-react/illustrated-message'
import { Divider } from '@swc-react/divider'
import type { SearchCondition, SearchSort } from '@shumai/dtos'

const PAGE_SIZE = 20

interface FileListViewProps {
  endpoint: string
  apiKey: string
  project: ProjectSummary
  onBackToProjects: () => void
  onLinkCountChange?: (count: number) => void
}

export const FileListView: React.FC<FileListViewProps> = ({
  endpoint,
  apiKey,
  project,
  onBackToProjects,
  onLinkCountChange,
}) => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(project.rootFolder || null)
  const [crumbs, setCrumbs] = useState<BreadcrumbCrumb[]>([])

  // Folders state
  const [folders, setFolders] = useState<AssetSummary[]>([])
  const [foldersTotal, setFoldersTotal] = useState<number | null>(null)
  const [foldersCursor, setFoldersCursor] = useState<string | null>(null)
  const [foldersHasNext, setFoldersHasNext] = useState(false)
  const [foldersExpanded, setFoldersExpanded] = useState(true)
  const [loadingMoreFolders, setLoadingMoreFolders] = useState(false)

  // Files state
  const [files, setFiles] = useState<AssetSummary[]>([])
  const [filesTotal, setFilesTotal] = useState<number | null>(null)
  const [filesCursor, setFilesCursor] = useState<string | null>(null)
  const [filesHasNext, setFilesHasNext] = useState(false)
  const [filesExpanded, setFilesExpanded] = useState(true)
  const [loadingMoreFiles, setLoadingMoreFiles] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [videoForDialog, setVideoForDialog] = useState<AssetSummary | null>(null)
  const [assetForLinkDialog, setAssetForLinkDialog] = useState<AssetSummary | null>(null)
  const [linkedAssetsMap, setLinkedAssetsMap] = useState<Record<string, LinkedSequenceAsset>>({})

  // Refresh links from cache and active Premiere project
  const refreshLinkedAssets = useCallback(async () => {
    // 1. Immediately read from cache (fast, non-blocking)
    const cachedLinks = getAllSequenceLinksFromCache()
    if (cachedLinks.length > 0) {
      const map: Record<string, LinkedSequenceAsset> = {}
      for (const link of cachedLinks) {
        if (!link.endpoint || isSameEndpoint(link.endpoint, endpoint)) {
          map[link.assetId] = link
        }
      }
      setLinkedAssetsMap((prev) => ({ ...prev, ...map }))
      onLinkCountChange?.(Object.keys(map).length)
    }

    // 2. Query active project in Premiere Pro for live persistent links
    try {
      const pr = await getActiveProject()
      if (pr) {
        const liveLinks = await getAllLinkedSequences(pr)
        const liveMap: Record<string, LinkedSequenceAsset> = {}
        for (const link of liveLinks) {
          if (!link.endpoint || isSameEndpoint(link.endpoint, endpoint)) {
            liveMap[link.assetId] = link
          }
        }
        setLinkedAssetsMap(liveMap)
        onLinkCountChange?.(Object.keys(liveMap).length)
      }
    } catch (err) {
      console.warn('[FileListView] Could not get linked sequences from active project:', err)
    }
  }, [endpoint, onLinkCountChange])

  useEffect(() => {
    void refreshLinkedAssets()
  }, [refreshLinkedAssets])

  const handleUnlinkAsset = useCallback(
    async (asset: AssetSummary) => {
      const link = linkedAssetsMap[asset.id]
      if (!link) return

      // Optimistically remove from state immediately
      setLinkedAssetsMap((prev) => {
        const copy = { ...prev }
        delete copy[asset.id]
        return copy
      })

      try {
        const pr = await getActiveProject()
        if (pr) {
          const allSeqs = await getAllSequences(pr)
          const targetSeq = allSeqs.find(
            (s) => normalizeGuid(s.guid) === normalizeGuid(link.sequenceGuid),
          )
          if (targetSeq) {
            await removeSequenceLink(pr, targetSeq)
          } else {
            removeSequenceLinkFromCache(link.sequenceGuid, pr.guid ? pr.guid.toString() : null)
          }
        } else {
          removeSequenceLinkFromCache(link.sequenceGuid)
        }
        void refreshLinkedAssets()
        setImportStatus({
          id: Date.now().toString(),
          fileName: asset.name,
          status: 'success',
          message: `Unlinked from "${link.sequenceName}".`,
        })
        setTimeout(() => {
          setImportStatus((prev) => (prev?.fileName === asset.name ? null : prev))
        }, 3000)
      } catch (err) {
        console.error('Failed to unlink asset:', err)
        void refreshLinkedAssets()
        setImportStatus({
          id: Date.now().toString(),
          fileName: asset.name,
          status: 'error',
          message: 'Failed to unlink sequence.',
        })
        setTimeout(() => {
          setImportStatus((prev) => (prev?.fileName === asset.name ? null : prev))
        }, 4000)
      }
    },
    [linkedAssetsMap, refreshLinkedAssets],
  )

  // Import task state
  const [importStatus, setImportStatus] = useState<{
    id: string
    fileName: string
    status: 'importing' | 'success' | 'error'
    message: string
  } | null>(null)

  const runImport = async (asset: AssetSummary, type: 'raw' | 'proxy', proxyItem?: ProxyOption) => {
    const taskId = Date.now().toString()
    const label = type === 'raw' ? asset.name : `${asset.name} (${proxyItem?.label || 'Proxy'})`
    setImportStatus({
      id: taskId,
      fileName: label,
      status: 'importing',
      message: 'Starting import...',
    })

    try {
      const result = await importAssetIntoPremiere({
        endpoint,
        apiKey,
        asset,
        type,
        proxyItem,
        onProgress: (msg) => {
          setImportStatus((prev) => (prev?.id === taskId ? { ...prev, message: msg } : prev))
        },
      })

      if (result.cancelled) {
        setImportStatus(null)
        return
      }

      if (result.success) {
        setImportStatus({
          id: taskId,
          fileName: result.fileName || label,
          status: 'success',
          message: result.message,
        })
        setTimeout(() => {
          setImportStatus((prev) => (prev?.id === taskId ? null : prev))
        }, 4000)
      } else {
        setImportStatus({
          id: taskId,
          fileName: label,
          status: 'error',
          message: result.message,
        })
        setTimeout(() => {
          setImportStatus((prev) => (prev?.id === taskId ? null : prev))
        }, 6000)
      }
    } catch (err) {
      setImportStatus({
        id: taskId,
        fileName: label,
        status: 'error',
        message: err instanceof Error ? err.message : 'Import failed.',
      })
      setTimeout(() => {
        setImportStatus((prev) => (prev?.id === taskId ? null : prev))
      }, 6000)
    }
  }

  const handleImportRaw = (asset: AssetSummary) => {
    runImport(asset, 'raw')
  }

  const handleImportProxy = (asset: AssetSummary, proxy: ProxyOption) => {
    runImport(asset, 'proxy', proxy)
  }

  // Debounce search term by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Initial fetch of both folders and files
  const fetchContents = useCallback(
    async (folderId: string, query: string) => {
      setLoading(true)
      setError(null)
      try {
        const client = getShumaiClient(endpoint, apiKey)
        const isSearching = Boolean(query)

        const conditions: SearchCondition[] = isSearching
          ? [{ field: 'name', operator: 'contains', value: query }]
          : []

        const sort: SearchSort = { field: 'name', order: 'asc' }

        // Fetch first page of folders and files in parallel
        const [foldersRes, filesRes] = await Promise.all([
          client.api.folders[':folderId'].search.$post({
            param: { folderId },
            json: {
              assetType: 'folder',
              recursively: isSearching,
              conditions,
              sort,
              first: PAGE_SIZE,
              previewFormat: 'jpeg',
            },
          }),
          client.api.folders[':folderId'].search.$post({
            param: { folderId },
            json: {
              assetType: 'file',
              recursively: isSearching,
              conditions,
              sort,
              first: PAGE_SIZE,
              previewFormat: 'jpeg',
            },
          }),
        ])

        if (!foldersRes.ok) {
          const errData = (await foldersRes.json().catch(() => ({}))) as { error?: string }
          throw new Error(errData.error || `Failed to search folders (${foldersRes.status})`)
        }
        if (!filesRes.ok) {
          const errData = (await filesRes.json().catch(() => ({}))) as { error?: string }
          throw new Error(errData.error || `Failed to search files (${filesRes.status})`)
        }

        const foldersBody = await foldersRes.json()
        const filesBody = await filesRes.json()

        const folderItems = (foldersBody.data || []) as AssetSummary[]
        const fileItems = (filesBody.data || []) as AssetSummary[]

        setFolders(folderItems)
        setFoldersCursor(foldersBody.pageInfo?.cursor || null)
        setFoldersHasNext(Boolean(foldersBody.pageInfo?.cursor))
        setFoldersTotal(foldersBody.pageInfo?.total ?? folderItems.length)

        setFiles(fileItems)
        setFilesCursor(filesBody.pageInfo?.cursor || null)
        setFilesHasNext(Boolean(filesBody.pageInfo?.cursor))
        setFilesTotal(filesBody.pageInfo?.total ?? fileItems.length)
      } catch (err) {
        console.error('Error fetching folder contents via search API:', err)
        setError(err instanceof Error ? err.message : 'Failed to load folder contents.')
      } finally {
        setLoading(false)
      }
    },
    [endpoint, apiKey],
  )

  useEffect(() => {
    if (currentFolderId) {
      fetchContents(currentFolderId, debouncedSearch)
    } else {
      setError('Root folder ID not available for this project.')
      setLoading(false)
    }
  }, [currentFolderId, debouncedSearch, fetchContents])

  // Paginate next files
  const fetchNextFilesPage = useCallback(async () => {
    if (!currentFolderId || !filesHasNext || loadingMoreFiles || loading) return
    setLoadingMoreFiles(true)
    try {
      const client = getShumaiClient(endpoint, apiKey)
      const isSearching = Boolean(debouncedSearch)
      const conditions: SearchCondition[] = isSearching
        ? [{ field: 'name', operator: 'contains', value: debouncedSearch }]
        : []
      const sort: SearchSort = { field: 'name', order: 'asc' }

      const res = await client.api.folders[':folderId'].search.$post({
        param: { folderId: currentFolderId },
        json: {
          assetType: 'file',
          recursively: isSearching,
          conditions,
          sort,
          first: PAGE_SIZE,
          after: filesCursor || undefined,
          previewFormat: 'jpeg',
        },
      })
      if (res.ok) {
        const body = await res.json()
        const newFiles = (body.data || []) as AssetSummary[]
        setFiles((prev) => [...prev, ...newFiles])
        setFilesCursor(body.pageInfo?.cursor || null)
        setFilesHasNext(Boolean(body.pageInfo?.cursor))
        if (body.pageInfo?.total != null) {
          setFilesTotal(body.pageInfo.total)
        }
      }
    } catch (err) {
      console.error('Error fetching next files page:', err)
    } finally {
      setLoadingMoreFiles(false)
    }
  }, [
    currentFolderId,
    filesHasNext,
    loadingMoreFiles,
    loading,
    endpoint,
    apiKey,
    debouncedSearch,
    filesCursor,
  ])

  // Paginate next folders
  const fetchNextFoldersPage = useCallback(async () => {
    if (!currentFolderId || !foldersHasNext || loadingMoreFolders || loading) return
    setLoadingMoreFolders(true)
    try {
      const client = getShumaiClient(endpoint, apiKey)
      const isSearching = Boolean(debouncedSearch)
      const conditions: SearchCondition[] = isSearching
        ? [{ field: 'name', operator: 'contains', value: debouncedSearch }]
        : []
      const sort: SearchSort = { field: 'name', order: 'asc' }

      const res = await client.api.folders[':folderId'].search.$post({
        param: { folderId: currentFolderId },
        json: {
          assetType: 'folder',
          recursively: isSearching,
          conditions,
          sort,
          first: PAGE_SIZE,
          after: foldersCursor || undefined,
          previewFormat: 'jpeg',
        },
      })
      if (res.ok) {
        const body = await res.json()
        const newFolders = (body.data || []) as AssetSummary[]
        setFolders((prev) => [...prev, ...newFolders])
        setFoldersCursor(body.pageInfo?.cursor || null)
        setFoldersHasNext(Boolean(body.pageInfo?.cursor))
        if (body.pageInfo?.total != null) {
          setFoldersTotal(body.pageInfo.total)
        }
      }
    } catch (err) {
      console.error('Error fetching next folders page:', err)
    } finally {
      setLoadingMoreFolders(false)
    }
  }, [
    currentFolderId,
    foldersHasNext,
    loadingMoreFolders,
    loading,
    endpoint,
    apiKey,
    debouncedSearch,
    foldersCursor,
  ])

  // Infinite scroll listener
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const threshold = 120
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight <= threshold
    if (isNearBottom) {
      if (filesExpanded && filesHasNext && !loadingMoreFiles) {
        fetchNextFilesPage()
      } else if (
        foldersExpanded &&
        foldersHasNext &&
        !loadingMoreFolders &&
        (!filesExpanded || files.length === 0)
      ) {
        fetchNextFoldersPage()
      }
    }
  }

  const handleFolderClick = (folder: AssetSummary) => {
    setCrumbs((prev) => [...prev, { id: folder.id, name: folder.name }])
    setCurrentFolderId(folder.id)
    setSearchTerm('')
  }

  const handleCrumbNavigate = (crumbIndex: number) => {
    setSearchTerm('')
    if (crumbIndex === -1) {
      setCrumbs([])
      if (project.rootFolder) {
        setCurrentFolderId(project.rootFolder)
      }
    } else {
      const targetCrumb = crumbs[crumbIndex]
      setCrumbs((prev) => prev.slice(0, crumbIndex + 1))
      setCurrentFolderId(targetCrumb.id)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Breadcrumb
        projectName={project.name}
        crumbs={crumbs}
        onNavigateToProjects={onBackToProjects}
        onNavigateToCrumb={handleCrumbNavigate}
      />

      {/* Sticky Header: Search input & Refresh button */}
      <div className="view-sticky-header">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
          }}
        >
          <div style={{ flex: 1 }}>
            <Search
              style={{ width: '100%' }}
              placeholder="Search files and folders..."
              value={searchTerm}
              onInput={(e: React.FormEvent<HTMLElement>) =>
                setSearchTerm((e.target as HTMLInputElement).value)
              }
            />
          </div>

          <sp-button
            quiet
            variant="secondary"
            size="s"
            label="Refresh folder"
            icon-only
            onClick={() => {
              if (currentFolderId) {
                fetchContents(currentFolderId, debouncedSearch)
                void refreshLinkedAssets()
              }
            }}
            title="Refresh folder"
            disabled={loading || !currentFolderId}
          >
            <sp-icon-refresh
              slot="icon"
              size="s"
              className={loading ? 'spin' : ''}
            ></sp-icon-refresh>
          </sp-button>
        </div>
        <Divider size="s" />
      </div>

      <div className="view-content" onScroll={handleScroll}>
        {loading && (
          <div className="state-container">
            <ProgressCircle indeterminate size="m" label="Loading folder contents..." />
            <p style={{ marginTop: '8px' }}>Loading folder contents...</p>
          </div>
        )}

        {error && !loading && (
          <div className="state-container">
            <IllustratedMessage heading="Error loading folder" description={error}>
              <sp-icon-alert-circle
                size="xxl"
                style={{ color: 'var(--accent-red)' }}
              ></sp-icon-alert-circle>
            </IllustratedMessage>
            {currentFolderId && (
              <Button
                variant="secondary"
                onClick={() => fetchContents(currentFolderId, debouncedSearch)}
                style={{ marginTop: '12px' }}
              >
                Try Again
              </Button>
            )}
          </div>
        )}

        {!loading && !error && folders.length === 0 && files.length === 0 && (
          <div className="state-container">
            <IllustratedMessage
              heading={searchTerm ? 'No matching items' : 'Folder is empty'}
              description={
                searchTerm
                  ? `No files or subfolders match "${searchTerm}".`
                  : 'No files or subfolders found in this directory.'
              }
            >
              <sp-icon-folder-open size="xxl" style={{ color: '#999999' }}></sp-icon-folder-open>
            </IllustratedMessage>
          </div>
        )}

        {!loading && !error && (folders.length > 0 || files.length > 0) && (
          <>
            {/* Folders Section */}
            {folders.length > 0 && (
              <div className="section-container">
                <div
                  className="section-header"
                  onClick={() => setFoldersExpanded(!foldersExpanded)}
                  role="button"
                  tabIndex={0}
                  title={foldersExpanded ? 'Collapse Folders' : 'Expand Folders'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setFoldersExpanded(!foldersExpanded)
                    }
                  }}
                >
                  <div className="section-header-left">
                    <sp-button
                      quiet
                      variant="secondary"
                      size="xs"
                      label={foldersExpanded ? 'Collapse Folders' : 'Expand Folders'}
                      icon-only
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                        setFoldersExpanded(!foldersExpanded)
                      }}
                    >
                      {foldersExpanded ? (
                        <sp-icon-chevron-down slot="icon" size="xs"></sp-icon-chevron-down>
                      ) : (
                        <sp-icon-chevron-right slot="icon" size="xs"></sp-icon-chevron-right>
                      )}
                    </sp-button>
                    <span className="section-title">Folders</span>
                    <span className="count-badge">{foldersTotal ?? folders.length}</span>
                  </div>
                </div>

                {foldersExpanded && (
                  <>
                    <div className="file-card-list">
                      {folders.map((folder) => (
                        <FileCardItem
                          key={folder.id}
                          asset={folder}
                          endpoint={endpoint}
                          onClick={() => handleFolderClick(folder)}
                        />
                      ))}
                    </div>

                    {foldersHasNext && (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
                        {loadingMoreFolders ? (
                          <ProgressCircle indeterminate size="s" label="Loading more folders..." />
                        ) : (
                          <ActionButton quiet size="s" onClick={fetchNextFoldersPage}>
                            Load more folders
                          </ActionButton>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Files Section */}
            {files.length > 0 && (
              <div
                className="section-container"
                style={{ marginTop: folders.length > 0 && foldersExpanded ? '14px' : '4px' }}
              >
                <div
                  className="section-header"
                  onClick={() => setFilesExpanded(!filesExpanded)}
                  role="button"
                  tabIndex={0}
                  title={filesExpanded ? 'Collapse Files' : 'Expand Files'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setFilesExpanded(!filesExpanded)
                    }
                  }}
                >
                  <div className="section-header-left">
                    <sp-button
                      quiet
                      variant="secondary"
                      size="xs"
                      label={filesExpanded ? 'Collapse Files' : 'Expand Files'}
                      icon-only
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                        setFilesExpanded(!filesExpanded)
                      }}
                    >
                      {filesExpanded ? (
                        <sp-icon-chevron-down slot="icon" size="xs"></sp-icon-chevron-down>
                      ) : (
                        <sp-icon-chevron-right slot="icon" size="xs"></sp-icon-chevron-right>
                      )}
                    </sp-button>
                    <span className="section-title">Files</span>
                    <span className="count-badge">{filesTotal ?? files.length}</span>
                  </div>
                </div>

                {filesExpanded && (
                  <>
                    <div className="file-card-list">
                      {files.map((file) => (
                        <FileCardItem
                          key={file.id}
                          asset={file}
                          endpoint={endpoint}
                          apiKey={apiKey}
                          onClick={() => {}}
                          onImportRaw={handleImportRaw}
                          onSelectVideoForImport={setVideoForDialog}
                          onLinkSequence={setAssetForLinkDialog}
                          onUnlinkSequence={handleUnlinkAsset}
                          isLinked={Boolean(linkedAssetsMap[file.id])}
                          linkedSequenceName={linkedAssetsMap[file.id]?.sequenceName}
                        />
                      ))}
                    </div>

                    {loadingMoreFiles && (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
                        <ProgressCircle indeterminate size="s" label="Loading more files..." />
                      </div>
                    )}

                    {filesHasNext && !loadingMoreFiles && (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
                        <ActionButton quiet size="s" onClick={fetchNextFilesPage}>
                          Load more files
                        </ActionButton>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Video Import Modal Dialog */}
      <ImportVideoDialog
        asset={videoForDialog}
        endpoint={endpoint}
        apiKey={apiKey}
        isOpen={videoForDialog != null}
        onClose={() => setVideoForDialog(null)}
        onImportRaw={handleImportRaw}
        onImportProxy={handleImportProxy}
      />

      {/* Sequence Linking Modal Dialog */}
      <LinkSequenceDialog
        asset={assetForLinkDialog}
        endpoint={endpoint}
        apiKey={apiKey}
        isOpen={assetForLinkDialog != null}
        onClose={() => setAssetForLinkDialog(null)}
        onLinkSuccess={(newLink, addedCount) => {
          setLinkedAssetsMap((prev) => ({
            ...prev,
            [newLink.assetId]: newLink,
          }))
          void refreshLinkedAssets()
          setImportStatus({
            id: Date.now().toString(),
            fileName: newLink.assetName,
            status: 'success',
            message: `Linked to "${newLink.sequenceName}". Synced ${addedCount} comment ${addedCount === 1 ? 'marker' : 'markers'}.`,
          })
        }}
      />

      {/* Toast Notification for Import Progress & Status */}
      {importStatus && (
        <div className={`shumai-import-toast ${importStatus.status}`}>
          <div className="shumai-toast-left">
            {importStatus.status === 'importing' && (
              <ProgressCircle indeterminate size="s" label="Importing..." />
            )}
            {importStatus.status === 'success' && <StatusLight variant="positive"></StatusLight>}
            {importStatus.status === 'error' && <StatusLight variant="negative"></StatusLight>}
            <div className="shumai-toast-text">
              <span className="shumai-toast-title">{importStatus.fileName}</span>
              <span className="shumai-toast-msg">{importStatus.message}</span>
            </div>
          </div>
          <sp-action-button
            quiet
            size="xs"
            onClick={() => setImportStatus(null)}
            title="Dismiss notification"
          >
            ×
          </sp-action-button>
        </div>
      )}
    </div>
  )
}
