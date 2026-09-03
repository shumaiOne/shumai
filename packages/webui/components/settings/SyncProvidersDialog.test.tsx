// @vitest-environment happy-dom
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SyncProvidersDialog } from './SyncProvidersDialog'
import type { SyncCheckResponse } from '@shumai/dtos'

describe('SyncProvidersDialog', () => {
  afterEach(() => {
    cleanup()
  })

  const mockSyncData: SyncCheckResponse = {
    totalNewProviders: 1,
    totalNewModels: 3,
    providers: [
      {
        name: 'test-new-provider',
        isNewProvider: true,
        config: { api: 'openai-responses', apiKey: 'NEW_KEY' },
        models: [
          {
            modelId: 'm-new-1',
            name: 'New Model 1',
            config: {
              api: 'openai-responses',
              reasoning: true,
              input: ['text'],
              contextWindow: 128000,
              maxTokens: 4096,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            },
          },
          {
            modelId: 'm-new-2',
            name: 'New Model 2',
            config: {
              api: 'openai-responses',
              reasoning: false,
              input: ['text'],
              contextWindow: 64000,
              maxTokens: 2048,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            },
          },
        ],
      },
      {
        name: 'test-existing-provider',
        isNewProvider: false,
        config: { api: 'anthropic-messages', apiKey: 'EXISTING_KEY' },
        models: [
          {
            modelId: 'm-existing-add-1',
            name: 'Existing Provider New Model 1',
            config: {
              api: 'anthropic-messages',
              reasoning: false,
              input: ['text'],
              contextWindow: 200000,
              maxTokens: 8192,
              cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
            },
          },
        ],
      },
    ],
  }

  function renderDialog(props?: Partial<React.ComponentProps<typeof SyncProvidersDialog>>) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    return render(
      <QueryClientProvider client={queryClient}>
        <SyncProvidersDialog
          isOpen={true}
          onClose={vi.fn()}
          teamId="team-1"
          syncData={mockSyncData}
          onSuccess={vi.fn()}
          {...props}
        />
      </QueryClientProvider>,
    )
  }

  it('renders the dialog with description, providers and models pre-selected by default', () => {
    renderDialog()

    // Title and description
    expect(screen.getByRole('heading', { name: /sync providers & models/i })).toBeDefined()
    expect(
      screen.getAllByText(
        /existing providers, custom endpoints, api keys, and model configurations will never be deleted or modified/i,
      ).length,
    ).toBeGreaterThan(0)

    // Check provider names
    expect(screen.getByText('test-new-provider')).toBeDefined()
    expect(screen.getByText('test-existing-provider')).toBeDefined()

    // Badges
    expect(screen.getByText(/^new provider$/i)).toBeDefined()
    expect(screen.getByText(/^existing provider$/i)).toBeDefined()

    // Check that both new and existing providers have checkboxes
    const newProviderCheckbox = document.getElementById('provider-check-test-new-provider')
    expect(newProviderCheckbox).toBeDefined()
    expect(newProviderCheckbox?.getAttribute('data-state')).toBe('checked')

    const existingProviderCheckbox = document.getElementById(
      'provider-check-test-existing-provider',
    )
    expect(existingProviderCheckbox).toBeDefined()
    expect(existingProviderCheckbox?.getAttribute('data-state')).toBe('checked')

    // Model checkboxes are checked by default
    const mNew1Check = document.getElementById('model-check-test-new-provider-m-new-1')
    expect(mNew1Check).toBeDefined()
    expect(mNew1Check?.getAttribute('data-state')).toBe('checked')
  })

  it('toggles all models for an existing provider when its checkbox is clicked', () => {
    renderDialog()

    const existingProviderCheckbox = document.getElementById(
      'provider-check-test-existing-provider',
    )!
    const existingModelCheck = document.getElementById(
      'model-check-test-existing-provider-m-existing-add-1',
    )!

    expect(existingModelCheck.getAttribute('data-state')).toBe('checked')

    // Click to uncheck all
    fireEvent.click(existingProviderCheckbox)
    expect(existingModelCheck.getAttribute('data-state')).toBe('unchecked')
    expect(existingProviderCheckbox.getAttribute('data-state')).toBe('unchecked')

    // Click to check all
    fireEvent.click(existingProviderCheckbox)
    expect(existingModelCheck.getAttribute('data-state')).toBe('checked')
    expect(existingProviderCheckbox.getAttribute('data-state')).toBe('checked')
  })

  it('supports select all and deselect all buttons', () => {
    renderDialog()

    const deselectAllBtn = screen.getByRole('button', { name: /^deselect all$/i })
    fireEvent.click(deselectAllBtn)

    const mNew1Check = document.getElementById('model-check-test-new-provider-m-new-1')
    expect(mNew1Check?.getAttribute('data-state')).toBe('unchecked')

    const selectAllBtn = screen.getByRole('button', { name: /^select all$/i })
    fireEvent.click(selectAllBtn)
    expect(mNew1Check?.getAttribute('data-state')).toBe('checked')
  })

  it('unchecks new provider when all its models are unchecked', () => {
    renderDialog()

    const mNew1Check = document.getElementById('model-check-test-new-provider-m-new-1')!
    const mNew2Check = document.getElementById('model-check-test-new-provider-m-new-2')!
    const newProviderCheckbox = document.getElementById('provider-check-test-new-provider')!

    // Uncheck both models
    fireEvent.click(mNew1Check)
    expect(newProviderCheckbox.getAttribute('data-state')).toBe('indeterminate')

    fireEvent.click(mNew2Check)
    expect(newProviderCheckbox.getAttribute('data-state')).toBe('unchecked')

    // Re-check one model -> provider should automatically check
    fireEvent.click(mNew1Check)
    expect(newProviderCheckbox.getAttribute('data-state')).not.toBe('unchecked')
  })

  it('filters models when user types in search input', () => {
    renderDialog()

    const searchInput = screen.getByPlaceholderText(/filter new providers or models/i)
    fireEvent.change(searchInput, { target: { value: 'm-existing-add-1' } })

    // Only existing provider model should be visible
    expect(screen.queryByText('m-new-1')).toBeNull()
    expect(screen.getByText('Existing Provider New Model 1')).toBeDefined()
  })

  it('supports expand all and collapse all buttons', () => {
    renderDialog()

    // Models should be visible initially (all expanded)
    expect(document.getElementById('model-check-test-new-provider-m-new-1')).toBeDefined()

    // Click Collapse All
    const collapseAllBtn = screen.getByRole('button', { name: /^collapse all$/i })
    fireEvent.click(collapseAllBtn)

    // Child models should be collapsed (not in DOM)
    expect(document.getElementById('model-check-test-new-provider-m-new-1')).toBeNull()

    // Click Expand All
    const expandAllBtn = screen.getByRole('button', { name: /^expand all$/i })
    fireEvent.click(expandAllBtn)

    // Child models should be visible again
    expect(document.getElementById('model-check-test-new-provider-m-new-1')).toBeDefined()
  })

  it('updates selection and expansion state when syncData prop changes while mounted', () => {
    const { rerender } = renderDialog()

    // Initially, test-new-provider is present
    expect(screen.getByText('test-new-provider')).toBeDefined()

    // Deselect all models to change internal state
    const deselectAllBtn = screen.getByRole('button', { name: /^deselect all$/i })
    fireEvent.click(deselectAllBtn)
    const mNew1Check = document.getElementById('model-check-test-new-provider-m-new-1')
    expect(mNew1Check?.getAttribute('data-state')).toBe('unchecked')

    // Now supply new syncData prop with different providers and models
    const updatedSyncData: SyncCheckResponse = {
      totalNewProviders: 1,
      totalNewModels: 1,
      providers: [
        {
          name: 'updated-provider',
          isNewProvider: true,
          config: { api: 'openai-responses' },
          models: [
            {
              modelId: 'm-updated-1',
              name: 'Updated Model 1',
              config: {
                api: 'openai-responses',
                reasoning: false,
                input: ['text'],
                contextWindow: 32000,
                maxTokens: 1024,
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              },
            },
          ],
        },
      ],
    }

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    rerender(
      <QueryClientProvider client={queryClient}>
        <SyncProvidersDialog
          isOpen={true}
          onClose={vi.fn()}
          teamId="team-1"
          syncData={updatedSyncData}
          onSuccess={vi.fn()}
        />
      </QueryClientProvider>,
    )

    // New provider should be rendered, expanded by default, and model should be pre-selected
    expect(screen.getByText('updated-provider')).toBeDefined()
    const updatedModelCheck = document.getElementById('model-check-updated-provider-m-updated-1')
    expect(updatedModelCheck).toBeDefined()
    expect(updatedModelCheck?.getAttribute('data-state')).toBe('checked')
  })
})
