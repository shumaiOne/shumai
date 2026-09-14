import React, { useEffect, useState } from 'react'
import { getShumaiClient } from '../api/client'
import { ProjectCard } from '../components/ProjectCard'
import {
  Briefcase,
  ChevronRight,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  AlertCircle,
} from 'lucide-react'

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
        query: { first: '200' },
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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600 }}>Projects</h2>
          {!loading && (
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              ({filteredProjects.length})
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className={`btn-icon ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid view"
          >
            <LayoutGrid size={13} />
          </button>
          <button
            className={`btn-icon ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <List size={13} />
          </button>
          <button
            className="btn-icon"
            onClick={fetchProjects}
            title="Refresh projects"
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'spinner' : ''} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      {projects.length > 2 && (
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <Search
            size={13}
            style={{
              position: 'absolute',
              left: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
            }}
          />
          <input
            type="text"
            className="input-text"
            style={{ width: '100%', paddingLeft: '28px', height: '28px' }}
            placeholder="Filter projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {loading && (
        <div className="state-container">
          <div className="spinner" />
          <p>Loading projects...</p>
        </div>
      )}

      {error && !loading && (
        <div className="state-container">
          <AlertCircle size={24} style={{ color: 'var(--accent-red)' }} />
          <h3>Error loading projects</h3>
          <p>{error}</p>
          <button className="btn" onClick={fetchProjects} style={{ marginTop: '8px' }}>
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="state-container">
          <Briefcase size={28} />
          <h3>No projects found</h3>
          <p>Create a project in your Shumai workspace to get started.</p>
        </div>
      )}

      {!loading && !error && projects.length > 0 && (
        <>
          {viewMode === 'grid' ? (
            <div className="project-grid">
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
                      <Briefcase size={16} />
                    </div>
                    <div className="item-meta">
                      <span className="item-name" title={project.name}>
                        {project.name}
                      </span>
                      <span className="item-subtext">ID: {project.id.slice(0, 10)}...</span>
                    </div>
                  </div>
                  <div className="item-right">
                    <ChevronRight size={14} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredProjects.length === 0 && (
            <div className="state-container" style={{ padding: '20px 0' }}>
              <p>No projects match "{searchTerm}".</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
