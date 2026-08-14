// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SelectMultiField from './select-multi-field'

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

describe('SelectMultiField Component', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  const sampleConfig = {
    name: 'Tags',
    type: 'selectMulti' as const,
    selectMulti: {
      options: [
        { id: 'foo', displayName: 'Foo', color: '#ff0000' },
        { id: 'bar', displayName: 'Bar', color: '#00ff00' },
        { id: 'abc', displayName: 'abc', color: '#0000ff' },
      ],
    },
  }

  it('renders Empty placeholder when no values selected', () => {
    render(<SelectMultiField value={[]} config={sampleConfig} onSave={vi.fn()} />)
    expect(screen.getByText('Empty')).toBeTruthy()
  })

  it('filters options based on search query in MultiSelect', () => {
    render(<SelectMultiField value={[]} config={sampleConfig} onSave={vi.fn()} />)

    // Click trigger to open popover
    const trigger = screen.getByText('Empty')
    fireEvent.click(trigger)

    const searchInput = screen.getByPlaceholderText('Search options...')
    expect(searchInput).toBeTruthy()

    // Type "bc" -> should show "abc" and "Add options: bc"
    fireEvent.change(searchInput, { target: { value: 'bc' } })
    expect(screen.getByText('abc')).toBeTruthy()
    expect(screen.queryByText('Foo')).toBeNull()

    expect(screen.getByText('Add options: bc')).toBeTruthy()
  })

  it('hides add option button when exact match exists in MultiSelect', () => {
    render(<SelectMultiField value={[]} config={sampleConfig} onSave={vi.fn()} />)

    const trigger = screen.getByText('Empty')
    fireEvent.click(trigger)

    const searchInput = screen.getByPlaceholderText('Search options...')

    // Type "abc" -> exact match
    fireEvent.change(searchInput, { target: { value: 'abc' } })
    expect(screen.getByText('abc')).toBeTruthy()
    expect(screen.queryByText('Add options: abc')).toBeNull()

    // Type "foo" -> exact match with option id "foo" / displayName "Foo"
    fireEvent.change(searchInput, { target: { value: 'foo' } })
    expect(screen.queryByText('Add options: foo')).toBeNull()
  })

  it('calls API and onSave when adding a new option in MultiSelect', async () => {
    const onSave = vi.fn()
    const { client } = await import('@/ui/api/client')
    vi.mocked(client.api.fields[':fieldId'].$put).mockResolvedValue({
      ok: true,
      json: async () => ({}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(
      <SelectMultiField
        value={['foo']}
        config={sampleConfig}
        fieldId="field_multi_123"
        onSave={onSave}
      />,
    )

    const trigger = screen.getByText('Foo')
    fireEvent.click(trigger)

    const searchInput = screen.getByPlaceholderText('Search options...')
    fireEvent.change(searchInput, { target: { value: 'New Multi Option' } })

    const addBtn = screen.getByText('Add options: New Multi Option')
    expect(addBtn).toBeTruthy()
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(client.api.fields[':fieldId'].$put).toHaveBeenCalledWith(
        expect.objectContaining({
          param: { fieldId: 'field_multi_123' },
        }),
      )
      expect(onSave).toHaveBeenCalledWith(['foo', 'new-multi-option'])
    })
  })
})
