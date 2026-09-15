import React, { useEffect, useState } from 'react'
import { getShumaiClient } from '../api/client'
import { ProjectCard } from '../components/ProjectCard'
import { Briefcase, ChevronRight, LayoutGrid, List, RefreshCw, AlertCircle } from 'lucide-react'
import { ActionButton } from '@swc-react/action-button'
import { ActionGroup } from '@swc-react/action-group'
import { Button } from '@swc-react/button'
import { Search } from '@swc-react/search'
import { Badge } from '@swc-react/badge'
import { ProgressCircle } from '@swc-react/progress-circle'
import { IllustratedMessage } from '@swc-react/illustrated-message'
import { Divider } from '@swc-react/divider'

export interface ProjectSummary {
  id: string
  name: string
  teamId: string
  rootFolder?: string | null
  coverImage?: string | null
  updatedAt?: string | Date
}

interface ProjectsViewProps {
  endpoint: string
  apiKey: string
  onSelectProject: (project: ProjectSummary) => void
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  endpoint,
  apiKey,
  onSelectProject,
}) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const fetchProjects = async () => {
    setLoading(true)
    setError(null)
    try {
      const client = getShumaiClient(endpoint, apiKey)
      const res = await client.api.projects.$get({
        query: { first: '200', previewFormat: 'jpeg' },
      })

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(errData.error || `Failed to fetch projects (${res.status})`)
      }

      const body = await res.json()
      setProjects((body.data || []) as ProjectSummary[])
    } catch (err) {
      console.error('Error fetching projects:', err)
      setError(err instanceof Error ? err.message : 'Failed to load projects.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [endpoint, apiKey])

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="view-content">
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600 }}>Projects</h2>
          {!loading && (
            <Badge variant="neutral" size="s">
              {filteredProjects.length}
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
            onClick={fetchProjects}
            title="Refresh projects"
            aria-label="Refresh projects"
            disabled={loading}
          >
            {loading ? (
              <ProgressCircle indeterminate size="s" slot="icon" />
            ) : (
              <RefreshCw size={13} slot="icon" color="#999999" />
            )}
          </ActionButton>
        </div>
      </div>

      {/* Search Input */}
      {projects.length > 2 && (
        <div style={{ marginBottom: '12px' }}>
          <Search
            style={{ width: '100%' }}
            placeholder="Filter projects..."
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
          <ProgressCircle indeterminate size="m" label="Loading projects..." />
          <p style={{ marginTop: '8px' }}>Loading projects...</p>
        </div>
      )}

      {error && !loading && (
        <div className="state-container">
          <IllustratedMessage heading="Error loading projects" description={error}>
            <AlertCircle size={36} style={{ color: 'var(--accent-red)' }} />
          </IllustratedMessage>
          <Button variant="secondary" onClick={fetchProjects} style={{ marginTop: '12px' }}>
            Try Again
          </Button>
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="state-container">
          <IllustratedMessage
            heading="No projects found"
            description="Create a project in your Shumai workspace to get started."
          >
            <Briefcase size={36} color="#999999" />
          </IllustratedMessage>
        </div>
      )}

      {!loading && !error && projects.length > 0 && (
        <>
          {viewMode === 'grid' ? (
            <div className="project-card-list">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  endpoint={endpoint}
                  onClick={() => onSelectProject(project)}
                />
              ))}
            </div>
          ) : (
            <div className="item-list">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="item-row"
                  onClick={() => onSelectProject(project)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectProject(project)
                    }
                  }}
                >
                  <div className="item-left">
                    <div className="item-icon" style={{ color: 'var(--accent-blue)' }}>
                      <Briefcase size={16} color="#3b82f6" />
                    </div>
                    <div className="item-meta">
                      <span className="item-name" title={project.name}>
                        {project.name}
                      </span>
                      <span className="item-subtext">ID: {project.id.slice(0, 10)}...</span>
                    </div>
                  </div>
                  <div className="item-right">
                    <ChevronRight size={14} color="#999999" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredProjects.length === 0 && (
            <div className="state-container" style={{ padding: '20px 0' }}>
              <IllustratedMessage
                heading="No matching projects"
                description={`No projects match "${searchTerm}".`}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
