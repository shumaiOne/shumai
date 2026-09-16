// @vitest-environment happy-dom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { NavigationTabs } from './NavigationTabs'

describe('NavigationTabs Component', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders Sequences and Browse tabs with badge', () => {
    const handleTabChange = vi.fn()
    render(<NavigationTabs activeTab="sequences" onTabChange={handleTabChange} linkedCount={3} />)

    expect(screen.getByText('Sequences')).toBeDefined()
    expect(screen.getByText('Browse')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
  })

  it('handles tab click events', () => {
    const handleTabChange = vi.fn()
    render(<NavigationTabs activeTab="sequences" onTabChange={handleTabChange} linkedCount={0} />)

    const browseTab = screen.getByText('Browse')
    fireEvent.click(browseTab)
    expect(handleTabChange).toHaveBeenCalledWith('browse')

    const sequencesTab = screen.getByText('Sequences')
    fireEvent.click(sequencesTab)
    expect(handleTabChange).toHaveBeenCalledWith('sequences')
  })
})
