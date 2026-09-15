import React from 'react'
import { Divider } from '@swc-react/divider'

export interface BreadcrumbCrumb {
  id: string
  name: string
}

interface BreadcrumbProps {
  projectName?: string
  crumbs: BreadcrumbCrumb[]
  onNavigateToProjects: () => void
  onNavigateToCrumb: (index: number) => void
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  projectName,
  crumbs,
  onNavigateToProjects,
  onNavigateToCrumb,
}) => {
  return (
    <>
      <nav className="breadcrumb-bar" aria-label="Folder Path">
        <span className="breadcrumb-item" onClick={onNavigateToProjects} title="Back to Projects">
          Projects
        </span>

        {projectName && (
          <>
            <span className="breadcrumb-separator">/</span>
            <span
              className={`breadcrumb-item ${crumbs.length === 0 ? 'active' : ''}`}
              onClick={() => onNavigateToCrumb(-1)}
              title={projectName}
            >
              {projectName}
            </span>
          </>
        )}

        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1
          return (
            <React.Fragment key={crumb.id}>
              <span className="breadcrumb-separator">/</span>
              <span
                className={`breadcrumb-item ${isLast ? 'active' : ''}`}
                onClick={() => (!isLast ? onNavigateToCrumb(idx) : undefined)}
                title={crumb.name}
              >
                {crumb.name}
              </span>
            </React.Fragment>
          )
        })}
      </nav>
      <Divider size="s" />
    </>
  )
}
