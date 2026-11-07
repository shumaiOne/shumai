// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FieldInfo } from '@shumai/dtos'
import { FilterPanel } from './filter-panel'

vi.mock('@/ui/hooks/use-team-id', () => ({
  useTeamId: () => 'team-1',
}))

vi.mock('@/ui/stores/members', () => ({
  useMemberStore: () => ({
    members: [],
    fetchMembers: vi.fn(),
  }),
}))

vi.mock('@/ui/hooks/use-archive-config', () => ({
  useArchiveConfig: () => ({
    archiveStorageEnabled: false,
  }),
}))

describe('FilterPanel', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders "Name" once without duplicating when fields contains system name field', () => {
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
    ]

    render(
      <FilterPanel
        fields={mockFields}
        conditions={[{ field: 'name', operator: 'eq', value: 'sample' }]}
        onChange={vi.fn()}
      />,
    )

    const selectTrigger = document.querySelector('[data-slot="select-trigger"]')
    expect(selectTrigger).not.toBeNull()
    expect(selectTrigger?.textContent).toBe('Name')
  })
})
