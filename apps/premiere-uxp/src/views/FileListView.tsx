import React, { useEffect, useState, useCallback } from 'react'
import { getShumaiClient } from '../api/client'
import { Breadcrumb, BreadcrumbCrumb } from '../components/Breadcrumb'
import { FileItem, FileCardItem, AssetSummary } from '../components/FileItem'
import { ProjectSummary } from './ProjectsView'
import { FolderOpen, RefreshCw, AlertCircle, LayoutGrid, List, Search } from 'lucide-react'
import { ActionButton } from '@swc-react/action-button'
import { Button } from '@swc-react/button'
import { Textfield } from '@swc-react/textfield'
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {loading
              ? 'Refreshing...'
              : `${sortedAssets.length} item${sortedAssets.length === 1 ? '' : 's'}`}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ActionButton
              quiet
              size="s"
              selected={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              title="Card view"
              aria-label="Card view"
            >
              <LayoutGrid size={13} slot="icon" />
            </ActionButton>
            <ActionButton
              quiet
              size="s"
              selected={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              title="Compact list view"
              aria-label="Compact list view"
            >
              <List size={13} slot="icon" />
            </ActionButton>
            <ActionButton
              quiet
              size="s"
              onClick={() => currentFolderId && fetchContents(currentFolderId, debouncedSearch)}
              title="Refresh folder"
              aria-label="Refresh folder"
              disabled={loading || !currentFolderId}
            >
              <RefreshCw size={13} slot="icon" className={loading ? 'spinner' : ''} />
            </ActionButton>
          </div>
        </div>

        {/* Search input if items exist or search is active */}
        {(assets.length > 0 || searchTerm) && (
          <div style={{ marginBottom: '10px' }}>
            <Textfield
              style={{ width: '100%' }}
              placeholder="Search files..."
              value={searchTerm}
              onInput={(e: React.FormEvent<HTMLElement>) =>
                setSearchTerm((e.target as HTMLInputElement).value)
              }
            >
              <Search size={13} slot="icon" />
            </Textfield>
          </div>
        )}

        {loading && (
          <div className="state-container">
            <div className="spinner" />
            <p>Loading files...</p>
          </div>
        )}

        {error && !loading && (
          <div className="state-container">
            <AlertCircle size={24} style={{ color: 'var(--accent-red)' }} />
            <h3>Error loading folder</h3>
            <p>{error}</p>
            {currentFolderId && (
              <Button
                variant="secondary"
                onClick={() => fetchContents(currentFolderId, debouncedSearch)}
                style={{ marginTop: '8px' }}
              >
                Try Again
              </Button>
            )}
          </div>
        )}

        {!loading && !error && sortedAssets.length === 0 && (
          <div className="state-container">
            <FolderOpen size={28} />
            <h3>Folder is empty</h3>
            <p>
              {searchTerm
                ? `No files match "${searchTerm}"`
                : 'No files or subfolders found in this directory.'}
            </p>
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
