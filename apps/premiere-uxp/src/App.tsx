import React, { useEffect, useState } from 'react'
import { Header } from './components/Header'
import { NavigationTabs, type MainTab } from './components/NavigationTabs'
import { AuthView } from './views/AuthView'
import { ProjectsView, ProjectSummary } from './views/ProjectsView'
import { FileListView } from './views/FileListView'
import { SequencesView } from './views/SequencesView'
import { getStoredCredentials, clearStoredCredentials } from './services/storage'
import { getAllSequenceLinksFromCache } from './services/linkStorage'
import { resetClient } from './api/client'
import { autoSyncService } from './services/autoSyncService'
import { ProgressCircle } from '@swc-react/progress-circle'

type AppView = 'auth' | 'projects' | 'files'

export const App: React.FC = () => {
  const [view, setView] = useState<AppView>('auth')
  const [mainTab, setMainTab] = useState<MainTab>('browse')
  const [linkedCount, setLinkedCount] = useState<number>(0)
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
      autoSyncService.start(creds.endpoint, creds.apiKey)
      const cached = getAllSequenceLinksFromCache()
      setLinkedCount(cached.length)
    } else {
      setView('auth')
    }
    setInitialLoading(false)

    return () => {
      autoSyncService.stop()
    }
  }, [])

  const handleConnectSuccess = (newEndpoint: string, newApiKey: string) => {
    setEndpoint(newEndpoint)
    setApiKey(newApiKey)
    setView('projects')
    autoSyncService.start(newEndpoint, newApiKey)
  }

  const handleDisconnect = () => {
    autoSyncService.stop()
    clearStoredCredentials()
    resetClient()
    setEndpoint('')
    setApiKey('')
    setSelectedProject(null)
    setView('auth')
    setMainTab('browse')
  }

  const handleSelectProject = (project: ProjectSummary) => {
    setSelectedProject(project)
    setView('files')
    setMainTab('browse')
  }

  const handleBackToProjects = () => {
    setSelectedProject(null)
    setView('projects')
    setMainTab('browse')
  }

  if (initialLoading) {
    return (
      <div className="app-container">
        <Header />
        <div className="view-content" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <ProgressCircle indeterminate size="l" label="Loading Shumai..." />
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

      {view !== 'auth' && (
        <NavigationTabs activeTab={mainTab} onTabChange={setMainTab} linkedCount={linkedCount} />
      )}

      {view === 'auth' && (
        <AuthView
          initialEndpoint={endpoint || 'http://localhost:3000'}
          initialApiKey={apiKey}
          onConnectSuccess={handleConnectSuccess}
        />
      )}

      {view !== 'auth' && mainTab === 'sequences' && (
        <SequencesView endpoint={endpoint} apiKey={apiKey} onLinkCountChange={setLinkedCount} />
      )}

      {view !== 'auth' && mainTab === 'browse' && view === 'projects' && (
        <ProjectsView endpoint={endpoint} apiKey={apiKey} onSelectProject={handleSelectProject} />
      )}

      {view !== 'auth' && mainTab === 'browse' && view === 'files' && selectedProject && (
        <FileListView
          endpoint={endpoint}
          apiKey={apiKey}
          project={selectedProject}
          onBackToProjects={handleBackToProjects}
          onLinkCountChange={setLinkedCount}
        />
      )}
    </div>
  )
}
