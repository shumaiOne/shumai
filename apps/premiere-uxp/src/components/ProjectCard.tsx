import React, { useState } from 'react'
import { formatDateAgo } from '../utils/date'
import { resolveAssetUrl } from '../utils/url'
import type { ProjectSummary } from '../views/ProjectsView'

interface ProjectCardProps {
  project: ProjectSummary
  endpoint?: string
  onClick: () => void
}

export const ShumaiPolygonCover: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 180.95 164.7"
    preserveAspectRatio="xMidYMid slice"
    style={{ width: '100%', height: '100%', display: 'block' }}
  >
    <polygon fill="#FC9F8E" points="0 18.5 0 76.0 151.69 164.7 180.95 164.7 180.95 113.6" />
    <polygon fill="#FEBAB8" points="0 0 74.58 61.5 90.53 51.6 110.33 63.9 180.95 18.9 180.95 0" />
    <polyline
      fill="#FAA5A5"
      points="0 18.5 74.58 61.5 90.53 51.6 110.33 63.9 180.95 18.9 180.95 0 0 0"
    />
    <polygon fill="#EC5B6C" points="0 76.0 0 164.7 151.69 164.7" />
    <polygon fill="#E85C71" points="180.95 18.9 110.33 63.9 117.37 68.0 117.26 73.4 180.95 113.6" />
    <polygon
      fill="#C8405B"
      points="117.26 73.4 117.37 99.0 90.53 114.9 174.35 164.7 180.95 164.7 180.95 113.6"
    />
    <polygon fill="#FFCCBE" points="90.53 51.6 63.69 68.1 90.53 83.4" />
    <path
      fill="#FB9991"
      d="M 90.53 51.6 L 90.53 61.3 L 100.87 67.4 L 90.53 73.5 L 90.53 83.4 L 117.37 68.0 C 117.15 67.6 90.53 51.6 90.53 51.6 Z"
    />
    <path
      fill="#FFEACD"
      d="M 63.69 68.1 C 63.47 68.5 64.02 99.3 64.02 99.3 C 64.02 99.3 64.46 99.6 64.9 99.9 L 90.53 83.4 L 63.69 68.1 Z"
    />
    <polygon fill="#FFCFB5" points="64.02 99.3 90.53 114.9 90.53 83.4" />
    <path fill="#F67D73" d="M 90.53 83.4 L 90.53 114.9 L 117.37 99.0 Z" />
    <path fill="#F26560" d="M 90.53 83.4 L 117.37 99.0 L 117.37 68.0 Z" />
    <polygon fill="#EB5F5B" points="80.08 67.5 90.53 73.5 90.53 61.3" />
    <polygon fill="#DB4D50" points="90.53 61.3 90.53 73.5 100.87 67.4" />
  </svg>
)

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, endpoint, onClick }) => {
  const [imgError, setImgError] = useState(false)
  const updatedText = formatDateAgo(project.updatedAt)
  const coverUrl = resolveAssetUrl(project.coverImage, endpoint)

  return (
    <div
      className="project-row-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      title={project.name}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className="project-row-preview">
        {coverUrl && !imgError ? (
          <img
            src={coverUrl}
            alt={project.name}
            className="project-row-img"
            onError={() => setImgError(true)}
          />
        ) : (
          <ShumaiPolygonCover />
        )}
      </div>

      <div className="project-row-content">
        <span className="project-row-title">{project.name}</span>
        <span className="project-row-subtext">
          {updatedText ? `Updated ${updatedText}` : 'Project'}
        </span>
      </div>
    </div>
  )
}
