// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DateField from './date-field'

describe('DateField Component', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  const dummyConfig = {
    name: 'Due Date',
    type: 'date' as const,
    date: {
      displayFormat: 'iso' as const,
      includeTime: false,
    },
  }

  const dummyConfigWithTime = {
    name: 'Event Time',
    type: 'date' as const,
    date: {
      displayFormat: 'iso' as const,
      includeTime: true,
      timeFormat: 'twenty_four_hour' as const,
    },
  }

  it('renders Empty state when value is empty', () => {
    render(<DateField value="" config={dummyConfig} onSave={vi.fn()} />)
    expect(screen.getByText('Empty')).toBeTruthy()
  })

  it('renders formatted date when value is present', () => {
    render(<DateField value="2026-06-15T00:00:00.000Z" config={dummyConfig} onSave={vi.fn()} />)
    expect(screen.getByText(/2026-06-15/)).toBeTruthy()
  })

  it('opens calendar popover on click and calls onSave when selecting a day', () => {
    const onSave = vi.fn()
    render(<DateField value="2026-06-15T00:00:00.000Z" config={dummyConfig} onSave={onSave} />)

    // Click trigger to open popover
    const trigger = screen.getByText(/2026-06-15/)
    fireEvent.click(trigger)

    // Month heading should be present
    expect(screen.getByText(/June 2026/i)).toBeTruthy()

    // Day 20 button should be clickable
    const day20 = screen.getByRole('button', { name: '20' })
    fireEvent.click(day20)

    expect(onSave).toHaveBeenCalled()
    const savedArg = onSave.mock.calls[0][0]
    expect(new Date(savedArg).getDate()).toBe(20)
  })

  it('supports time picker when includeTime is true', () => {
    const onSave = vi.fn()
    render(
      <DateField value="2026-06-15T10:00:00.000Z" config={dummyConfigWithTime} onSave={onSave} />,
    )

    const trigger = screen.getByText(/2026-06-15/)
    fireEvent.click(trigger)

    // "Time" section should be visible
    expect(screen.getByText(/Time/)).toBeTruthy()

    // Select hour '14'
    const hour14 = screen.getByTestId('hour-14')
    fireEvent.click(hour14)

    expect(onSave).toHaveBeenCalled()
    const savedArg = onSave.mock.calls[0][0]
    expect(new Date(savedArg).getHours()).toBe(14)
  })

  it('does not open popover in readOnly mode', () => {
    const onSave = vi.fn()
    render(
      <DateField value="2026-06-15T00:00:00.000Z" config={dummyConfig} onSave={onSave} readOnly />,
    )

    const trigger = screen.getByText(/2026-06-15/)
    fireEvent.click(trigger)

    expect(screen.queryByText(/June 2026/i)).toBeNull()
  })
})
