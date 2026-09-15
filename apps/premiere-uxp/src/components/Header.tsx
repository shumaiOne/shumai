import React from 'react'
import { Divider } from '@swc-react/divider'
import { ShumaiLogo } from './icons'

interface HeaderProps {
  endpoint?: string
  onDisconnect?: () => void
}

export const Header: React.FC<HeaderProps> = ({ endpoint, onDisconnect }) => {
  let displayHost = ''
  if (endpoint) {
    try {
      const url = new URL(endpoint)
      displayHost = url.host
    } catch {
      displayHost = endpoint
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="logo-group">
          <div className="logo-icon">
            <ShumaiLogo width={18} height={18} />
          </div>
          <span className="app-title">Shumai</span>
        </div>

        {endpoint && onDisconnect && (
          <div className="actions-group">
            <div
              className="header-status"
              title={`Connected to ${endpoint}`}
              role="status"
              aria-label={`Connected to ${displayHost}`}
            >
              <span className="status-dot positive" />
              <span className="status-text">{displayHost}</span>
            </div>
            <sp-button
              quiet
              variant="secondary"
              size="s"
              label="Disconnect / Change Server"
              icon-only
              onClick={onDisconnect}
              title="Disconnect / Change Server"
            >
              <sp-icon-log-out slot="icon" size="s"></sp-icon-log-out>
            </sp-button>
          </div>
        )}
      </header>
      <Divider size="s" />
    </>
  )
}
