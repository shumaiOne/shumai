// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FieldInfo } from '@shumai/dtos'
import { SortControl } from './sort-control'

describe('SortControl', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders "Name" once in the selector when fields contains system name field', () => {
    const mockFields: FieldInfo[] = [
      {
        id: 'name',
        scope: 'SYSTEM',
        readOnly: true,
        visible: true,
        description: '',
        config: {
          name: 'Name',
          type: 'text',
        },
      },
      {
        id: 'custom_rating',
        scope: 'PROJECT',
        readOnly: false,
        visible: true,
        description: '',
        config: {
          name: 'Rating',
          type: 'rating',
        },
      },
    ]

    render(
      <SortControl
        fields={mockFields}
        sort={{ field: 'name', order: 'asc' }}
        onSortChange={vi.fn()}
      />,
    )

    // Open the sort popover
    const popoverButton = screen.getByRole('button')
    fireEvent.click(popoverButton)

    // The select trigger inside the popover must display "Name", not "NameName"
    const selectTrigger = document.querySelector('[data-slot="select-trigger"]')
    expect(selectTrigger).not.toBeNull()
    expect(selectTrigger?.textContent).toBe('Name')
  })

  it('calls onSortChange when changing sort field', () => {
    const onSortChange = vi.fn()
    const mockFields: FieldInfo[] = [
      {
        id: 'custom_status',
        scope: 'PROJECT',
        readOnly: false,
        visible: true,
        description: '',
        config: {
          name: 'Status',
          type: 'select',
        },
      },
    ]

    render(
      <SortControl
        fields={mockFields}
        sort={{ field: 'name', order: 'asc' }}
        onSortChange={onSortChange}
      />,
    )

    const popoverButton = screen.getByRole('button')
    fireEvent.click(popoverButton)

    // Order toggle button should show "A → Z" when sorted by name asc
    const orderButton = screen.getByRole('button', { name: /A\s*→\s*Z/i })
    expect(orderButton).toBeDefined()

    // Toggle direction
    fireEvent.click(orderButton)
    expect(onSortChange).toHaveBeenCalledWith({
      field: 'name',
      order: 'desc',
    })
  })
})
