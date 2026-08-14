// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SelectField from './select-field'

// Mock client and stores
vi.mock('@/ui/api/client', () => ({
  client: {
    api: {
      fields: {
        ':fieldId': {
          $put: vi.fn(),
        },
      },
    },
  },
}))

vi.mock('@/ui/stores/fields', () => ({
  useFieldStore: {
    getState: () => ({
      fields: [],
      updateFields: vi.fn(),
    }),
  },
}))

describe('SelectField Component', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  const sampleConfig = {
    name: 'Status',
    type: 'select' as const,
    select: {
      options: [
        { id: 'foo', displayName: 'Foo', color: '#ff0000' },
        { id: 'bar', displayName: 'Bar', color: '#00ff00' },
        { id: 'abc', displayName: 'abc', color: '#0000ff' },
      ],
    },
  }

  it('renders selected option badge correctly', () => {
    const { container } = render(<SelectField value="foo" config={sampleConfig} onSave={vi.fn()} />)
    const badge = screen.getByText('Foo')
    expect(badge).toBeTruthy()
    expect(badge.className).toContain('h-[22px]')
    const trigger = container.querySelector('div[class*="h-[28px]"]')
    expect(trigger).toBeTruthy()
  })

  it('renders placeholder with text-sm styling', () => {
    const { container } = render(<SelectField value="" config={sampleConfig} onSave={vi.fn()} />)
    const placeholder = screen.getByText('Select an option')
    expect(placeholder).toBeTruthy()
    expect(placeholder.className).toContain('text-sm')
    const trigger = container.querySelector('div[class*="h-[28px]"]')
    expect(trigger).toBeTruthy()
  })

  it('filters options based on search query', () => {
    render(<SelectField value="" config={sampleConfig} onSave={vi.fn()} />)

    // Click trigger to open popover
    const trigger = screen.getByText('Select an option')
    fireEvent.click(trigger)

    // Search box should be visible
    const searchInput = screen.getByPlaceholderText('Search options...')
    expect(searchInput).toBeTruthy()

    // Type "bc" -> should only show "abc" and "Add options: bc"
    fireEvent.change(searchInput, { target: { value: 'bc' } })
    expect(screen.getByText('abc')).toBeTruthy()
    expect(screen.queryByText('Foo')).toBeNull()
    expect(screen.queryByText('Bar')).toBeNull()

    // Add option action should be present for "bc"
    expect(screen.getByText('Add options: bc')).toBeTruthy()
  })

  it('hides add option button when user input matches an option exactly', () => {
    render(<SelectField value="" config={sampleConfig} onSave={vi.fn()} />)

    const trigger = screen.getByText('Select an option')
    fireEvent.click(trigger)

    const searchInput = screen.getByPlaceholderText('Search options...')

    // Type "abc" -> exact match with option "abc"
    fireEvent.change(searchInput, { target: { value: 'abc' } })
    expect(screen.getByText('abc')).toBeTruthy()
    // "Add options: abc" button should be hidden
    expect(screen.queryByText('Add options: abc')).toBeNull()
    // Type "foo" -> exact match with option id "foo" / displayName "Foo"
    fireEvent.change(searchInput, { target: { value: 'foo' } })
    expect(screen.queryByText('Add options: foo')).toBeNull()
  })

  it('calls API and onSave when adding a new option', async () => {
    const onSave = vi.fn()
    const { client } = await import('@/ui/api/client')
    vi.mocked(client.api.fields[':fieldId'].$put).mockResolvedValue({
      ok: true,
      json: async () => ({}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<SelectField value="" config={sampleConfig} fieldId="field_123" onSave={onSave} />)

    const trigger = screen.getByText('Select an option')
    fireEvent.click(trigger)

    const searchInput = screen.getByPlaceholderText('Search options...')
    fireEvent.change(searchInput, { target: { value: 'New Custom Option' } })

    const addBtn = screen.getByText('Add options: New Custom Option')
    expect(addBtn).toBeTruthy()
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(client.api.fields[':fieldId'].$put).toHaveBeenCalledWith(
        expect.objectContaining({
          param: { fieldId: 'field_123' },
        }),
      )
      expect(onSave).toHaveBeenCalledWith('new-custom-option')
    })
  })
})
