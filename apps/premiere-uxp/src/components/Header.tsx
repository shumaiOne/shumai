import React from 'react'
import { LogOut, Server } from 'lucide-react'

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
    <header className="app-header">
      <div className="logo-group">
        <span className="logo-badge">S</span>
        <span className="app-title">Shumai</span>
      </div>

      {endpoint && onDisconnect && (
        <div className="actions-group">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: 'var(--text-secondary)',
            }}
            title={`Connected to ${endpoint}`}
          >
            <Server size={12} />
            <span
              style={{
                maxWidth: '140px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayHost}
            </span>
          </div>
          <button
            className="btn-icon"
            onClick={onDisconnect}
            title="Disconnect / Change Server"
            aria-label="Disconnect"
          >
            <LogOut size={13} />
          </button>
        </div>
      )}
    </header>
  )
}
