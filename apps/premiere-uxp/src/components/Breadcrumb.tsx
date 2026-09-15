import React from 'react'
import { ChevronRight, Home, Folder } from 'lucide-react'
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
          <Home size={11} />
          <span>Projects</span>
        </span>

        {projectName && (
          <>
            <ChevronRight size={10} className="breadcrumb-separator" />
            <span
              className={`breadcrumb-item ${crumbs.length === 0 ? 'active' : ''}`}
              onClick={() => onNavigateToCrumb(-1)}
              title={projectName}
            >
              <Folder size={11} />
              <span>{projectName}</span>
            </span>
          </>
        )}

        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1
          return (
            <React.Fragment key={crumb.id}>
              <ChevronRight size={10} className="breadcrumb-separator" />
              <span
                className={`breadcrumb-item ${isLast ? 'active' : ''}`}
                onClick={() => (!isLast ? onNavigateToCrumb(idx) : undefined)}
                title={crumb.name}
              >
                <span>{crumb.name}</span>
              </span>
            </React.Fragment>
          )
        })}
      </nav>
      <Divider size="s" />
    </>
  )
}
