// @vitest-environment happy-dom
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ImageVideoGenerationSettings } from './ImageVideoGenerationSettings'
import type { MediaGenerationSettingsResponse } from '@shumai/dtos'

const mockGetSettings = vi.fn()
const mockPutProvider = vi.fn()
const mockGetCurated = vi.fn()

vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      teams: {
        ':teamId': {
          'media-generation': {
            $get: () => mockGetSettings(),
            providers: {
              ':provider': {
                $put: (args: unknown) => mockPutProvider(args),
              },
            },
            models: {
              curated: {
                $get: (args: unknown) => mockGetCurated(args),
              },
            },
          },
        },
      },
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('ImageVideoGenerationSettings', () => {
  const initialSettings: MediaGenerationSettingsResponse = {
    providers: [
      {
        provider: 'openai',
        defaultEnvKey: 'OPENAI_API_KEY',
        apiKeyConfigured: true,
        status: 'configured_env',
        supportedTypes: ['image'],
      },
      {
        provider: 'klingai',
        defaultEnvKey: 'KLINGAI_API_KEY',
        apiKeyConfigured: true,
        status: 'configured_custom',
        customApiKeyOrEnv: 'my-custom-key',
        supportedTypes: ['video'],
      },
      {
        provider: 'fal',
        defaultEnvKey: 'FAL_KEY',
        apiKeyConfigured: false,
        status: 'not_configured',
        supportedTypes: ['image', 'video'],
      },
    ],
    enabledModels: [
      {
        id: 'model-1',
        type: 'image',
        provider: 'openai',
        modelId: 'dall-e-3',
        name: 'DALL-E 3',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'model-2',
        type: 'video',
        provider: 'klingai',
        modelId: 'kling-v1-standard',
        name: 'Kling v1',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  }

  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    mockGetSettings.mockResolvedValue({
      ok: true,
      json: async () => initialSettings,
    })
    mockPutProvider.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
    mockGetCurated.mockResolvedValue({
      ok: true,
      json: async () => [
        { modelId: 'dall-e-3', name: 'DALL-E 3', type: 'image' },
        { modelId: 'dall-e-2', name: 'DALL-E 2', type: 'image' },
      ],
    })
  })

  afterEach(() => {
    cleanup()
  })

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ImageVideoGenerationSettings teamId="team-123" />
      </QueryClientProvider>,
    )

  it('renders providers list with enabled model count badges and no outer tabs', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeDefined()
      expect(screen.getByText('Kling AI')).toBeDefined()
      expect(screen.getByText('Fal')).toBeDefined()
    })

    // No outer tabs should exist
    expect(screen.queryByRole('tablist')).toBeNull()

    // OpenAI row shows 1 enabled (image)
    const openaiRow = screen.getByText('OpenAI').closest('.group') as HTMLElement
    expect(within(openaiRow).getByText('1 enabled')).toBeDefined()

    // Kling AI row shows 1 enabled (video)
    const klingRow = screen.getByText('Kling AI').closest('.group') as HTMLElement
    expect(within(klingRow).getByText('1 enabled')).toBeDefined()

    // Fal row shows 0 enabled for both image and video
    const falRow = screen.getByText('Fal').closest('.group') as HTMLElement
    expect(within(falRow).getAllByText('0 enabled')).toHaveLength(2)
  })

  it('opens dialog with smart default tab based on API key configuration', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeDefined()
    })

    // 1. OpenAI is configured -> opens to Models tab by default
    const openaiRow = screen.getByText('OpenAI').closest('.cursor-pointer')!
    fireEvent.click(openaiRow)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined()
      // Models tab should be active
      const modelsTab = screen.getByRole('tab', { name: /Models/i })
      expect(modelsTab.getAttribute('data-state')).toBe('active')
    })

    // Close dialog with Cancel
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    // 2. Fal is not configured -> opens to API Key tab by default
    const falRow = screen.getByText('Fal').closest('.cursor-pointer')!
    fireEvent.click(falRow)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined()
      const apiKeyTab = screen.getByRole('tab', { name: /API Key/i })
      expect(apiKeyTab.getAttribute('data-state')).toBe('active')
    })
  })

  it('stages API key changes and saves on global footer Save click', async () => {
    renderComponent()

    await waitFor(() => screen.getByText('OpenAI'))
    fireEvent.click(screen.getByText('OpenAI').closest('.cursor-pointer')!)

    await waitFor(() => screen.getByRole('dialog'))

    // Switch to API Key tab
    fireEvent.click(screen.getByRole('tab', { name: /API Key/i }))

    await waitFor(() => {
      expect(document.getElementById('provider-api-key')).not.toBeNull()
    })

    const input = document.getElementById('provider-api-key') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'sk-new-key' } })

    // Save button in footer
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockPutProvider).toHaveBeenCalledWith({
        param: { teamId: 'team-123', provider: 'openai' },
        json: {
          apiKey: 'sk-new-key',
          models: [
            {
              type: 'image',
              modelId: 'dall-e-3',
              name: 'DALL-E 3',
            },
          ],
        },
      })
    })
  })

  it('allows clearing custom API key in API Key tab', async () => {
    renderComponent()

    await waitFor(() => screen.getByText('Kling AI'))
    fireEvent.click(screen.getByText('Kling AI').closest('.cursor-pointer')!)

    await waitFor(() => screen.getByRole('dialog'))

    // Switch to API Key tab
    fireEvent.click(screen.getByRole('tab', { name: /API Key/i }))

    await waitFor(() => {
      expect(document.getElementById('provider-api-key')).not.toBeNull()
    })

    // Kling AI has custom key 'my-custom-key'
    const input = document.getElementById('provider-api-key') as HTMLInputElement
    expect(input.value).toBe('my-custom-key')

    // Click Clear Custom Key
    const clearBtn = screen.getByRole('button', { name: /Clear Custom Key/i })
    fireEvent.click(clearBtn)

    expect(input.value).toBe('')

    // Click Save
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockPutProvider).toHaveBeenCalledWith({
        param: { teamId: 'team-123', provider: 'klingai' },
        json: {
          apiKey: '',
          models: [
            {
              type: 'video',
              modelId: 'kling-v1-standard',
              name: 'Kling v1',
            },
          ],
        },
      })
    })
  })

  it('stages model toggles and adds custom models before saving', async () => {
    renderComponent()

    await waitFor(() => screen.getByText('OpenAI'))
    fireEvent.click(screen.getByText('OpenAI').closest('.cursor-pointer')!)

    await waitFor(() => screen.getByRole('dialog'))

    // Wait for curated models to load
    await waitFor(() => {
      expect(screen.getByText('DALL-E 3')).toBeDefined()
      expect(screen.getByText('DALL-E 2')).toBeDefined()
    })

    // DALL-E 3 is initially enabled (checked)
    const dalle3Switch = screen.getByLabelText('Toggle DALL-E 3')
    expect(dalle3Switch.getAttribute('data-state')).toBe('checked')

    // DALL-E 2 is initially disabled (unchecked)
    const dalle2Switch = screen.getByLabelText('Toggle DALL-E 2')
    expect(dalle2Switch.getAttribute('data-state')).toBe('unchecked')

    // Toggle DALL-E 2 ON
    fireEvent.click(dalle2Switch)
    expect(dalle2Switch.getAttribute('data-state')).toBe('checked')

    // Add a custom model
    const customInput = screen.getByPlaceholderText('Enter custom model ID')
    fireEvent.change(customInput, { target: { value: 'custom-gpt-image' } })

    const addBtn = screen.getByRole('button', { name: 'Add' })
    fireEvent.click(addBtn)

    // Verify custom model is displayed in the list
    await waitFor(() => {
      expect(screen.getAllByText('custom-gpt-image').length).toBeGreaterThan(0)
    })

    // Click Save in the global footer
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockPutProvider).toHaveBeenCalledWith({
        param: { teamId: 'team-123', provider: 'openai' },
        json: {
          apiKey: '',
          models: [
            { type: 'image', modelId: 'dall-e-3', name: 'DALL-E 3' },
            { type: 'image', modelId: 'dall-e-2', name: 'DALL-E 2' },
            { type: 'image', modelId: 'custom-gpt-image', name: 'custom-gpt-image' },
          ],
        },
      })
    })
  })

  it('discards staged changes when clicking Cancel', async () => {
    renderComponent()

    await waitFor(() => screen.getByText('OpenAI'))
    fireEvent.click(screen.getByText('OpenAI').closest('.cursor-pointer')!)

    await waitFor(() => screen.getByRole('dialog'))

    // Wait for curated models
    await waitFor(() => screen.getByText('DALL-E 2'))

    // Toggle DALL-E 2 ON
    const dalle2Switch = screen.getByLabelText('Toggle DALL-E 2')
    fireEvent.click(dalle2Switch)

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelBtn)

    // Dialog should be closed
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    // mockPutProvider should NOT have been called
    expect(mockPutProvider).not.toHaveBeenCalled()
  })

  it('filters models with search input and supports custom model deletion', async () => {
    renderComponent()

    await waitFor(() => screen.getByText('OpenAI'))
    fireEvent.click(screen.getByText('OpenAI').closest('.cursor-pointer')!)

    await waitFor(() => screen.getByRole('dialog'))
    await waitFor(() => screen.getByText('DALL-E 3'))

    // Add a custom model
    const customInput = screen.getByPlaceholderText('Enter custom model ID')
    fireEvent.change(customInput, { target: { value: 'custom-to-delete' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(screen.getAllByText('custom-to-delete').length).toBeGreaterThan(0)
    })

    // Search for DALL-E 2
    const searchInput = screen.getByPlaceholderText('Search models by ID or name...')
    fireEvent.change(searchInput, { target: { value: 'DALL-E 2' } })

    expect(screen.getByText('DALL-E 2')).toBeDefined()
    expect(screen.queryByText('DALL-E 3')).toBeNull()
    expect(screen.queryByText('custom-to-delete')).toBeNull()

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } })
    expect(screen.getByText('DALL-E 3')).toBeDefined()
    expect(screen.getAllByText('custom-to-delete').length).toBeGreaterThan(0)

    // Delete custom model with trash button
    const deleteBtn = screen.getByTitle('Delete')
    fireEvent.click(deleteBtn)

    expect(screen.queryByText('custom-to-delete')).toBeNull()
  })

  it('shows warning notice when provider is not configured', async () => {
    renderComponent()

    await waitFor(() => screen.getByText('Fal'))
    fireEvent.click(screen.getByText('Fal').closest('.cursor-pointer')!)

    await waitFor(() => screen.getByRole('dialog'))

    // Fal opens to API Key by default, switch to Models tab
    fireEvent.click(screen.getByRole('tab', { name: /Models/i }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'This provider is not configured. Configure an API key in the API Key tab before using these models.',
        ),
      ).toBeDefined()
    })
  })
})
