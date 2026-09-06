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

  it('renders provider list and enabled models', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Kling AI').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Fal').length).toBeGreaterThan(0)
    })

    // Verify enabled models table
    expect(screen.getByText('dall-e-3')).toBeDefined()
    expect(screen.getByText('kling-v1-standard')).toBeDefined()
  })

  it('opens configure API key dialog and saves new key', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0)
    })

    const editButtons = screen.getAllByRole('button', { name: /Edit API Key/i })
    fireEvent.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined()
    })

    const input = document.querySelector('input[type="password"]') as HTMLInputElement
    expect(input).toBeDefined()
    fireEvent.change(input, { target: { value: 'sk-new-openai-test-key' } })

    const saveButton = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockPutProvider).toHaveBeenCalledWith({
        param: { teamId: 'team-123', provider: 'openai' },
        json: { apiKey: 'sk-new-openai-test-key' },
      })
    })
  })

  it('opens add model dialog and enables adding model', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0)
    })

    const addModelButtons = screen.getAllByRole('button', { name: /Add Model/i })
    fireEvent.click(addModelButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined()
    })
    expect(
      screen.getByText('Select the media generation type, provider, and model to enable.'),
    ).toBeDefined()
  })

  it('masks existing custom key and allows removing custom key', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getAllByText('Kling AI').length).toBeGreaterThan(0)
    })

    const editButtons = screen.getAllByRole('button', { name: /Edit API Key/i })
    // Kling AI is index 1
    fireEvent.click(editButtons[1])

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined()
    })

    const input = document.querySelector('input[type="password"]') as HTMLInputElement
    expect(input).toBeDefined()
    expect(input.value).toBe('') // Secret is not prefilled in the input
    expect(input.placeholder).toBe('••••••••') // Masked indicator

    const removeButton = screen.getByRole('button', { name: 'Remove Key' })
    fireEvent.click(removeButton)

    await waitFor(() => {
      expect(mockPutProvider).toHaveBeenCalledWith({
        param: { teamId: 'team-123', provider: 'klingai' },
        json: { apiKey: '' },
      })
    })
  })
})
