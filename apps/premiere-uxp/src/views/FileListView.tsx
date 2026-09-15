import React, { useEffect, useState, useCallback } from 'react'
import { getShumaiClient } from '../api/client'
import { Breadcrumb, BreadcrumbCrumb } from '../components/Breadcrumb'
import { FileItem, FileCardItem, AssetSummary } from '../components/FileItem'
import { ProjectSummary } from './ProjectsView'
import {
  FolderOpen,
  RefreshCw,
  AlertCircle,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { ActionButton } from '@swc-react/action-button'
import { ActionGroup } from '@swc-react/action-group'
import { Button } from '@swc-react/button'
import { Search } from '@swc-react/search'
import { Badge } from '@swc-react/badge'
import { ProgressCircle } from '@swc-react/progress-circle'
import { IllustratedMessage } from '@swc-react/illustrated-message'
import { Divider } from '@swc-react/divider'
import type { SearchCondition, SearchSort } from '@shumai/dtos'

const PAGE_SIZE = 20

interface FileListViewProps {
  endpoint: string
  apiKey: string
  project: ProjectSummary
  onBackToProjects: () => void
}

export const FileListView: React.FC<FileListViewProps> = ({
  endpoint,
  apiKey,
  project,
  onBackToProjects,
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

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

  const totalItemCount = (foldersTotal ?? folders.length) + (filesTotal ?? files.length)

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

      <div className="view-content" onScroll={handleScroll}>
        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Contents</span>
            {!loading && (
              <Badge variant="neutral" size="s">
                {totalItemCount}
              </Badge>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ActionGroup
              quiet
              size="s"
              selects="single"
              selected={[viewMode]}
              style={{ display: 'inline-flex' }}
            >
              <ActionButton
                value="grid"
                selected={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
                title="Card view"
                aria-label="Card view"
              >
                <LayoutGrid size={13} slot="icon" color="#999999" />
              </ActionButton>
              <ActionButton
                value="list"
                selected={viewMode === 'list'}
                onClick={() => setViewMode('list')}
                title="Compact list view"
                aria-label="Compact list view"
              >
                <List size={13} slot="icon" color="#999999" />
              </ActionButton>
            </ActionGroup>

            <ActionButton
              quiet
              size="s"
              onClick={() => currentFolderId && fetchContents(currentFolderId, debouncedSearch)}
              title="Refresh folder"
              aria-label="Refresh folder"
              disabled={loading || !currentFolderId}
            >
              {loading ? (
                <ProgressCircle indeterminate size="s" slot="icon" />
              ) : (
                <RefreshCw size={13} slot="icon" color="#999999" />
              )}
            </ActionButton>
          </div>
        </div>

        {/* Search input */}
        {(totalItemCount > 0 || searchTerm) && (
          <div style={{ marginBottom: '10px' }}>
            <Search
              style={{ width: '100%' }}
              placeholder="Search files and folders..."
              value={searchTerm}
              onInput={(e: React.FormEvent<HTMLElement>) =>
                setSearchTerm((e.target as HTMLInputElement).value)
              }
            />
          </div>
        )}

        <Divider size="s" style={{ marginBottom: '10px' }} />

        {loading && (
          <div className="state-container">
            <ProgressCircle indeterminate size="m" label="Loading folder contents..." />
            <p style={{ marginTop: '8px' }}>Loading folder contents...</p>
          </div>
        )}

        {error && !loading && (
          <div className="state-container">
            <IllustratedMessage heading="Error loading folder" description={error}>
              <AlertCircle size={36} style={{ color: 'var(--accent-red)' }} />
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
              <FolderOpen size={36} color="#999999" />
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
                    <ActionButton
                      quiet
                      size="s"
                      aria-label={foldersExpanded ? 'Collapse Folders' : 'Expand Folders'}
                      onClick={(e) => {
                        e.stopPropagation()
                        setFoldersExpanded(!foldersExpanded)
                      }}
                    >
                      {foldersExpanded ? (
                        <ChevronDown size={12} slot="icon" color="#999999" />
                      ) : (
                        <ChevronRight size={12} slot="icon" color="#999999" />
                      )}
                    </ActionButton>
                    <span className="section-title">Folders</span>
                    <Badge variant="neutral" size="s">
                      {foldersTotal ?? folders.length}
                    </Badge>
                  </div>
                </div>

                {foldersExpanded && (
                  <>
                    {viewMode === 'list' ? (
                      <div className="item-list">
                        {folders.map((folder) => (
                          <FileItem
                            key={folder.id}
                            asset={folder}
                            endpoint={endpoint}
                            onClick={() => handleFolderClick(folder)}
                          />
                        ))}
                      </div>
                    ) : (
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
                    )}

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
                    <ActionButton
                      quiet
                      size="s"
                      aria-label={filesExpanded ? 'Collapse Files' : 'Expand Files'}
                      onClick={(e) => {
                        e.stopPropagation()
                        setFilesExpanded(!filesExpanded)
                      }}
                    >
                      {filesExpanded ? (
                        <ChevronDown size={12} slot="icon" color="#999999" />
                      ) : (
                        <ChevronRight size={12} slot="icon" color="#999999" />
                      )}
                    </ActionButton>
                    <span className="section-title">Files</span>
                    <Badge variant="neutral" size="s">
                      {filesTotal ?? files.length}
                    </Badge>
                  </div>
                </div>

                {filesExpanded && (
                  <>
                    {viewMode === 'list' ? (
                      <div className="item-list">
                        {files.map((file) => (
                          <FileItem
                            key={file.id}
                            asset={file}
                            endpoint={endpoint}
                            onClick={() => {}}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="file-card-list">
                        {files.map((file) => (
                          <FileCardItem
                            key={file.id}
                            asset={file}
                            endpoint={endpoint}
                            onClick={() => {}}
                          />
                        ))}
                      </div>
                    )}

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
    </div>
  )
}
