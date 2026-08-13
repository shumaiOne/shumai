// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
    render(<SelectField value="foo" config={sampleConfig} onSave={vi.fn()} />)
    expect(screen.getByText('Foo')).toBeTruthy()
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
  })
})
