import React, { useEffect, useState, useCallback } from 'react'
import { getShumaiClient } from '../api/client'
import { Breadcrumb, BreadcrumbCrumb } from '../components/Breadcrumb'
import { FileItem, FileCardItem, AssetSummary } from '../components/FileItem'
import { ProjectSummary } from './ProjectsView'
import { FolderOpen, RefreshCw, AlertCircle, LayoutGrid, List } from 'lucide-react'
import { ActionButton } from '@swc-react/action-button'
import { ActionGroup } from '@swc-react/action-group'
import { Button } from '@swc-react/button'
import { Search } from '@swc-react/search'
import { Badge } from '@swc-react/badge'
import { ProgressCircle } from '@swc-react/progress-circle'
import { IllustratedMessage } from '@swc-react/illustrated-message'
import { Divider } from '@swc-react/divider'
import type { SearchCondition, SearchSort } from '@shumai/dtos'

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
  const [assets, setAssets] = useState<AssetSummary[]>([])
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

        // Use the Search API consistent with WebUI: search folders and files in parallel
        const [foldersRes, filesRes] = await Promise.all([
          client.api.folders[':folderId'].search.$post({
            param: { folderId },
            json: {
              assetType: 'folder',
              recursively: isSearching,
              conditions,
              sort,
              first: 100,
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
              first: 100,
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

        setAssets([...folderItems, ...fileItems])
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

  // Folders first, then alphabetical by name
  const sortedAssets = [...assets].sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1
    if (a.type !== 'folder' && b.type === 'folder') return 1
    return a.name.localeCompare(b.name)
  })

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

      <div className="view-content">
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
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Files</span>
            {!loading && (
              <Badge variant="neutral" size="s">
                {sortedAssets.length}
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
                <LayoutGrid size={13} slot="icon" />
              </ActionButton>
              <ActionButton
                value="list"
                selected={viewMode === 'list'}
                onClick={() => setViewMode('list')}
                title="Compact list view"
                aria-label="Compact list view"
              >
                <List size={13} slot="icon" />
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
                <RefreshCw size={13} slot="icon" />
              )}
            </ActionButton>
          </div>
        </div>

        {/* Search input if items exist or search is active */}
        {(assets.length > 0 || searchTerm) && (
          <div style={{ marginBottom: '10px' }}>
            <Search
              style={{ width: '100%' }}
              placeholder="Search files..."
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
            <ProgressCircle indeterminate size="m" label="Loading files..." />
            <p style={{ marginTop: '8px' }}>Loading files...</p>
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

        {!loading && !error && sortedAssets.length === 0 && (
          <div className="state-container">
            <IllustratedMessage
              heading={searchTerm ? 'No matching files' : 'Folder is empty'}
              description={
                searchTerm
                  ? `No files match "${searchTerm}"`
                  : 'No files or subfolders found in this directory.'
              }
            >
              <FolderOpen size={36} />
            </IllustratedMessage>
          </div>
        )}

        {!loading && !error && sortedAssets.length > 0 && (
          <>
            {viewMode === 'list' ? (
              <div className="item-list">
                {sortedAssets.map((asset) => (
                  <FileItem
                    key={asset.id}
                    asset={asset}
                    endpoint={endpoint}
                    onClick={() => {
                      if (asset.type === 'folder') {
                        handleFolderClick(asset)
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="file-card-list">
                {sortedAssets.map((asset) => (
                  <FileCardItem
                    key={asset.id}
                    asset={asset}
                    endpoint={endpoint}
                    onClick={() => {
                      if (asset.type === 'folder') {
                        handleFolderClick(asset)
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
