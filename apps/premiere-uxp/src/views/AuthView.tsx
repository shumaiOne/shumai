import React, { useState } from 'react'
import { getShumaiClient } from '../api/client'
import { saveStoredCredentials } from '../services/storage'
import { ArrowRight } from 'lucide-react'
import { Button } from '@swc-react/button'
import { Textfield } from '@swc-react/textfield'
import { FieldLabel } from '@swc-react/field-label'
import { HelpText } from '@swc-react/help-text'
import { ProgressCircle } from '@swc-react/progress-circle'

interface AuthViewProps {
  initialEndpoint?: string
  initialApiKey?: string
  onConnectSuccess: (endpoint: string, apiKey: string) => void
}

export const AuthView: React.FC<AuthViewProps> = ({
  initialEndpoint = 'http://localhost:3000',
  initialApiKey = '',
  onConnectSuccess,
}) => {
  const [endpoint, setEndpoint] = useState(initialEndpoint)
  const [apiKey, setApiKey] = useState(initialApiKey)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleConnect = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault()
    }
    setErrorMessage(null)

    const trimmedEndpoint = endpoint.trim().replace(/\/+$/, '')
    const trimmedKey = apiKey.trim()

    if (!trimmedEndpoint) {
      setErrorMessage('Please enter your Shumai server endpoint.')
      return
    }

    if (!trimmedKey) {
      setErrorMessage('Please enter your Shumai API key.')
      return
    }

    try {
      new URL(trimmedEndpoint)
    } catch {
      setErrorMessage(
        'Invalid endpoint URL. Example: http://localhost:3000 or https://shumai.example.com',
      )
      return
    }

    setLoading(true)
    console.log('[Shumai UXP] Connecting to:', trimmedEndpoint)

    try {
      const client = getShumaiClient(trimmedEndpoint, trimmedKey)
      const res = await client.api.projects.$get({
        query: { first: '1' },
      })

      console.log('[Shumai UXP] Response status:', res.status)

      if (res.status === 401) {
        setErrorMessage('Unauthorized: Invalid API Key. Please verify your token.')
        setLoading(false)
        return
      }

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { error?: string }
        setErrorMessage(errorData.error || `Connection failed with status ${res.status}`)
        setLoading(false)
        return
      }

      // Validated successfully
      saveStoredCredentials(trimmedEndpoint, trimmedKey)
      onConnectSuccess(trimmedEndpoint, trimmedKey)
    } catch (err) {
      console.error('[Shumai UXP] Failed to connect to Shumai server:', err)
      setErrorMessage(
        err instanceof Error
          ? `Cannot reach server: ${err.message}`
          : 'Could not connect to the Shumai server. Please check the URL and your network connection.',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConnect(e)
    }
  }

  return (
    <div className="view-content" style={{ justifyContent: 'center' }}>
      <div className="auth-container">
        <div className="auth-header">
          <h2>Connect to Shumai</h2>
          <p>Enter your server URL and API key to integrate Premiere Pro with your workspace.</p>
        </div>

        {errorMessage && (
          <div style={{ marginBottom: '12px' }}>
            <HelpText variant="negative" icon>
              {errorMessage}
            </HelpText>
          </div>
        )}

        <div className="auth-form">
          <div className="form-group">
            <FieldLabel for="endpoint-input">Server Endpoint</FieldLabel>
            <Textfield
              id="endpoint-input"
              style={{ width: '100%' }}
              placeholder="https://shumai.example.com"
              value={endpoint}
              onInput={(e: React.FormEvent<HTMLElement>) =>
                setEndpoint((e.target as HTMLInputElement).value)
              }
              onKeyDown={handleKeyDown}
              disabled={loading}
              invalid={Boolean(errorMessage && !endpoint.trim())}
            />
            <HelpText>The base URL of your Shumai backend instance.</HelpText>
          </div>

          <div className="form-group">
            <FieldLabel for="api-key-input">API Key</FieldLabel>
            <Textfield
              id="api-key-input"
              type="password"
              style={{ width: '100%' }}
              placeholder="Paste your API key here"
              value={apiKey}
              onInput={(e: React.FormEvent<HTMLElement>) =>
                setApiKey((e.target as HTMLInputElement).value)
              }
              onKeyDown={handleKeyDown}
              disabled={loading}
              invalid={Boolean(errorMessage && !apiKey.trim())}
            />
            <HelpText>Generate an API key in Shumai: Settings &gt; Developer.</HelpText>
          </div>

          <Button
            variant="accent"
            onClick={handleConnect}
            style={{ width: '100%', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? 'Connecting...' : 'Connect Workspace'}
            {loading ? (
              <ProgressCircle indeterminate size="s" static-color="white" slot="icon" />
            ) : (
              <ArrowRight size={14} slot="icon" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
