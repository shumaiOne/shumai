import React, { useEffect, useState } from 'react'
import { Header } from './components/Header'
import { AuthView } from './views/AuthView'
import { ProjectsView, ProjectSummary } from './views/ProjectsView'
import { FileListView } from './views/FileListView'
import { getStoredCredentials, clearStoredCredentials } from './services/storage'
import { resetClient } from './api/client'

type AppView = 'auth' | 'projects' | 'files'

export const App: React.FC = () => {
  const [view, setView] = useState<AppView>('auth')
  const [endpoint, setEndpoint] = useState<string>('')
  const [apiKey, setApiKey] = useState<string>('')
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    const creds = getStoredCredentials()
    if (creds && creds.endpoint && creds.apiKey) {
      setEndpoint(creds.endpoint)
      setApiKey(creds.apiKey)
      setView('projects')
    } else {
      setView('auth')
    }
    setInitialLoading(false)
  }, [])

  const handleConnectSuccess = (newEndpoint: string, newApiKey: string) => {
    setEndpoint(newEndpoint)
    setApiKey(newApiKey)
    setView('projects')
  }

  const handleDisconnect = () => {
    clearStoredCredentials()
    resetClient()
    setEndpoint('')
    setApiKey('')
    setSelectedProject(null)
    setView('auth')
  }

  const handleSelectProject = (project: ProjectSummary) => {
    setSelectedProject(project)
    setView('files')
  }

  const handleBackToProjects = () => {
    setSelectedProject(null)
    setView('projects')
  }

  if (initialLoading) {
    return (
      <div className="app-container">
        <Header />
        <div className="view-content" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <Header
        endpoint={view !== 'auth' ? endpoint : undefined}
        onDisconnect={view !== 'auth' ? handleDisconnect : undefined}
      />

      {view === 'auth' && (
        <AuthView
          initialEndpoint={endpoint || 'http://localhost:3000'}
          initialApiKey={apiKey}
          onConnectSuccess={handleConnectSuccess}
        />
      )}

      {view === 'projects' && (
        <ProjectsView endpoint={endpoint} apiKey={apiKey} onSelectProject={handleSelectProject} />
      )}

      {view === 'files' && selectedProject && (
        <FileListView
          endpoint={endpoint}
          apiKey={apiKey}
          project={selectedProject}
          onBackToProjects={handleBackToProjects}
        />
      )}
    </div>
  )
}
