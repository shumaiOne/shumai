import React from 'react'
import { StatusLight } from '@swc-react/status-light'
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
              title={`Connected to ${endpoint}`}
              style={{
                maxWidth: '140px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <StatusLight variant="positive" size="s" style={{ margin: 0 }}>
                {displayHost}
              </StatusLight>
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
