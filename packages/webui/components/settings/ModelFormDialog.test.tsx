// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModelFormDialog } from './ModelFormDialog'
import type { ModelFormValues } from './ModelFormDialog'

describe('ModelFormDialog', () => {
  afterEach(() => {
    cleanup()
  })

  const model1: ModelFormValues = {
    modelId: 'gpt-4o',
    name: 'GPT-4o Production',
    config: {
      api: 'openai-responses',
      reasoning: true,
      input: ['text', 'image'],
      contextWindow: 128000,
      maxTokens: 4096,
      cost: { input: 2.5, output: 10, cacheRead: 1.25, cacheWrite: 2.5 },
    },
  }

  const model2: ModelFormValues = {
    modelId: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    config: {
      api: 'anthropic-messages',
      reasoning: false,
      input: ['text'],
      contextWindow: 200000,
      maxTokens: 8192,
      cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    },
  }

  it('populates fields with initialValues when opened for editing', () => {
    render(
      <ModelFormDialog
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        title="Edit Model"
        initialValues={model1}
        defaultApi="openai-responses"
      />,
    )

    const modelIdInput = screen.getByLabelText(/model id/i) as HTMLInputElement
    const nameInput = screen.getByLabelText(/display name/i) as HTMLInputElement

    expect(modelIdInput.value).toBe('gpt-4o')
    expect(nameInput.value).toBe('GPT-4o Production')
  })

  it('updates fields when switching between different models', () => {
    const { rerender } = render(
      <ModelFormDialog
        key="model-1"
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        title="Edit Model"
        initialValues={model1}
        defaultApi="openai-responses"
      />,
    )

    let modelIdInput = screen.getByLabelText(/model id/i) as HTMLInputElement
    expect(modelIdInput.value).toBe('gpt-4o')

    rerender(
      <ModelFormDialog
        key="model-2"
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        title="Edit Model"
        initialValues={model2}
        defaultApi="anthropic-messages"
      />,
    )

    modelIdInput = screen.getByLabelText(/model id/i) as HTMLInputElement
    const nameInput = screen.getByLabelText(/display name/i) as HTMLInputElement

    expect(modelIdInput.value).toBe('claude-3-5-sonnet')
    expect(nameInput.value).toBe('Claude 3.5 Sonnet')
  })
})
