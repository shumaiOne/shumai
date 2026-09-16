import React, { useEffect, useState } from 'react'
import { getShumaiClient } from '../api/client'
import { ProjectCard } from '../components/ProjectCard'
import { Button } from '@swc-react/button'
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
      {/* Sticky Title Bar */}
      <div className="view-sticky-header">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600 }}>Projects</h2>
            {!loading && <span className="count-badge">{projects.length}</span>}
          </div>

          <sp-button
            quiet
            variant="secondary"
            size="s"
            label="Refresh projects"
            icon-only
            onClick={fetchProjects}
            title="Refresh projects"
            disabled={loading}
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

      <div className="view-content">
        {loading && (
          <div className="state-container">
            <ProgressCircle indeterminate size="m" label="Loading projects..." />
            <p style={{ marginTop: '8px' }}>Loading projects...</p>
          </div>
        )}

        {error && !loading && (
          <div className="state-container">
            <IllustratedMessage heading="Error loading projects" description={error}>
              <sp-icon-alert-circle
                size="xxl"
                style={{ color: 'var(--accent-red)' }}
              ></sp-icon-alert-circle>
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
              <sp-icon-briefcase size="xxl" style={{ color: '#999999' }}></sp-icon-briefcase>
            </IllustratedMessage>
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <div className="project-card-list">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                endpoint={endpoint}
                onClick={() => onSelectProject(project)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
