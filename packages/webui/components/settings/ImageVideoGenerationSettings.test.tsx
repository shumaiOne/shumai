// @vitest-environment happy-dom
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ImageVideoGenerationSettings } from './ImageVideoGenerationSettings'
import type { MediaGenerationSettingsResponse } from '@shumai/dtos'

const mockGetSettings = vi.fn()
const mockPutProvider = vi.fn()
const mockPostModel = vi.fn()
const mockDeleteModel = vi.fn()
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
              $post: (args: unknown) => mockPostModel(args),
              ':modelId': {
                $delete: (args: unknown) => mockDeleteModel(args),
              },
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
    mockPostModel.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'new-model-id',
        type: 'image',
        provider: 'openai',
        modelId: 'dall-e-2',
        name: 'DALL-E 2',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    })
    mockDeleteModel.mockResolvedValue({
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

  it('renders 2 tabs and switches between Providers and Enabled Models', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Kling AI').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Fal').length).toBeGreaterThan(0)
    })

    const openaiProvider = screen.getByText('OpenAI')
    expect(openaiProvider.className).toContain('whitespace-nowrap')
    const keySpan = screen.getByText('OPENAI_API_KEY')
    expect(keySpan.className).toContain('truncate')

    // Switch to Enabled Models tab
    const modelsTab = screen.getByRole('tab', { name: /Enabled Models/i })
    fireEvent.click(modelsTab)

    // Verify enabled models table content is displayed
    await waitFor(() => {
      expect(screen.getByText('dall-e-3')).toBeDefined()
      expect(screen.getByText('kling-v1-standard')).toBeDefined()
    })
  })

  it('opens configure API key dialog and saves new key or env var override', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0)
    })

    const editButtons = screen.getAllByRole('button', { name: /Edit API Key/i })
    fireEvent.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined()
    })

    // Input is type="text" and displays description
    const input = document.querySelector('input[type="text"]') as HTMLInputElement
    expect(input).toBeDefined()
    expect(
      screen.getByText(
        'You can provide a literal value (e.g. sk-...) or an Environment variable name (e.g. MY_API_KEY).',
      ),
    ).toBeDefined()

    fireEvent.change(input, { target: { value: 'OPENAI_API_NEW_KEY' } })

    const saveButton = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockPutProvider).toHaveBeenCalledWith({
        param: { teamId: 'team-123', provider: 'openai' },
        json: { apiKey: 'OPENAI_API_NEW_KEY' },
      })
    })
  })

  it('shows unmasked custom key/env in dialog and allows removing custom override', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('Kling AI').length).toBeGreaterThan(0)
    })

    // In the providers list row, Kling AI shows custom override
    expect(screen.getByText('my-custom-key')).toBeDefined()

    const editButtons = screen.getAllByRole('button', { name: /Edit API Key/i })
    // Kling AI is index 1
    fireEvent.click(editButtons[1])

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined()
    })

    // Input displays raw text 'my-custom-key'
    const input = document.querySelector('input[type="text"]') as HTMLInputElement
    expect(input).toBeDefined()
    expect(input.value).toBe('my-custom-key')

    // Click Remove Key
    const removeButton = screen.getByRole('button', { name: 'Remove Key' })
    fireEvent.click(removeButton)

    await waitFor(() => {
      expect(mockPutProvider).toHaveBeenCalledWith({
        param: { teamId: 'team-123', provider: 'klingai' },
        json: { apiKey: '' },
      })
    })
  })

  it('opens add model dialog with 2-card switch and 2-box provider/model selector', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0)
    })

    // Switch to Enabled Models tab
    const modelsTab = screen.getByRole('tab', { name: /Enabled Models/i })
    fireEvent.click(modelsTab)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Model/i })).toBeDefined()
    })

    const addModelButton = screen.getByRole('button', { name: /Add Model/i })
    fireEvent.click(addModelButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined()
    })

    // 2-card model type selector
    expect(screen.getByRole('button', { name: /Image/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Video/i })).toBeDefined()

    // Left box should show compatible providers for Image (OpenAI and Fal)
    expect(screen.getByText('Select a provider on the left to view available models')).toBeDefined()

    // Click OpenAI in providers list
    const openaiProviderBtn = screen.getByRole('button', { name: /OpenAI/i })
    fireEvent.click(openaiProviderBtn)

    // Right box loads curated models
    await waitFor(() => {
      expect(mockGetCurated).toHaveBeenCalled()
      expect(screen.getByRole('button', { name: /DALL-E 2/i })).toBeDefined()
    })

    // Select DALL-E 2
    const modelBtn = screen.getByRole('button', { name: /DALL-E 2/i })
    fireEvent.click(modelBtn)

    // Click Add
    const submitBtn = screen.getByRole('button', { name: /^Add$/ })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockPostModel).toHaveBeenCalledWith({
        param: { teamId: 'team-123' },
        json: {
          type: 'image',
          provider: 'openai',
          modelId: 'dall-e-2',
          name: 'DALL-E 2',
        },
      })
    })
  })

  it('supports selecting video type and custom model option', async () => {
    mockGetCurated.mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0)
    })

    // Switch to Enabled Models tab and open Add Model dialog
    fireEvent.click(screen.getByRole('tab', { name: /Enabled Models/i }))
    await waitFor(() => screen.getByRole('button', { name: /Add Model/i }))
    fireEvent.click(screen.getByRole('button', { name: /Add Model/i }))

    await waitFor(() => screen.getByRole('dialog'))

    // Switch to Video card
    const videoCard = screen.getByRole('button', { name: /Video/i })
    fireEvent.click(videoCard)

    // Select Kling AI
    await waitFor(() => screen.getByRole('button', { name: /Kling AI/i }))
    fireEvent.click(screen.getByRole('button', { name: /Kling AI/i }))

    // Select Custom Model option
    await waitFor(() => screen.getByRole('button', { name: /Custom Model\.\.\./i }))
    fireEvent.click(screen.getByRole('button', { name: /Custom Model\.\.\./i }))

    // Fill in custom model ID
    const customIdInput = screen.getByPlaceholderText('Enter custom model ID') as HTMLInputElement
    fireEvent.change(customIdInput, { target: { value: 'kling-v2-custom' } })

    // Click Add
    const submitBtn = screen.getByRole('button', { name: /^Add$/ })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockPostModel).toHaveBeenCalledWith({
        param: { teamId: 'team-123' },
        json: {
          type: 'video',
          provider: 'klingai',
          modelId: 'kling-v2-custom',
          name: 'kling-v2-custom',
        },
      })
    })
  })
})
