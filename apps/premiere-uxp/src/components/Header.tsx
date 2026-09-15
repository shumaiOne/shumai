import React from 'react'
import { LogOut } from 'lucide-react'
import { ActionButton } from '@swc-react/action-button'
import { StatusLight } from '@swc-react/status-light'
import { Divider } from '@swc-react/divider'

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
          <span className="logo-badge">S</span>
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
              }}
            >
              <StatusLight variant="positive" size="s">
                {displayHost}
              </StatusLight>
            </div>
            <ActionButton
              quiet
              size="s"
              onClick={onDisconnect}
              title="Disconnect / Change Server"
              aria-label="Disconnect"
            >
              <LogOut size={13} slot="icon" color="#999999" />
            </ActionButton>
          </div>
        )}
      </header>
      <Divider size="s" />
    </>
  )
}
