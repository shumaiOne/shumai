import { describe, it, expect } from 'vitest'
import {
  McpToolRegistry,
  formatToolName,
  normalizeSearchText,
  tokenize,
  scoreToolMatch,
  paginate,
} from './mcp-tool-registry'

function makeRegistry() {
  const registry = new McpToolRegistry()
  registry.setTools('server-1', 'xcodebuild', [
    { name: 'list_sims', description: 'Lists available simulator devices' },
    { name: 'build', description: 'Builds an Xcode project' },
    { name: 'showBuildSettings', description: 'Shows build settings for a target' },
  ])
  registry.setTools('server-2', 'github', [
    { name: 'create_issue', description: 'Creates a GitHub issue' },
    { name: 'list_issues', description: 'Lists issues in a repository' },
    { name: 'search_code', description: 'Searches code across repositories' },
  ])
  return registry
}

describe('formatToolName', () => {
  it('prefixes server name and sanitizes dots', () => {
    expect(formatToolName('xcodebuild', 'list_sims')).toBe('xcodebuild_list_sims')
    expect(formatToolName('my-server', 'tool.name')).toBe('my_server_tool_name')
  })
})

describe('normalizeSearchText / tokenize', () => {
  it('splits camelCase, snake_case, dots and hyphens', () => {
    expect(tokenize('showBuildSettings')).toEqual(['show', 'build', 'settings'])
    expect(tokenize('list_sims')).toEqual(['list', 'sims'])
    expect(tokenize('search.code-v2')).toEqual(['search', 'code', 'v2'])
  })

  it('lowercases input', () => {
    expect(normalizeSearchText('ListSims')).toBe('list sims')
  })
})

describe('scoreToolMatch', () => {
  const tool = {
    name: 'xcodebuild_list_sims',
    originalName: 'list_sims',
    description: 'Lists available simulator devices',
  }

  it('returns null for empty queries', () => {
    expect(scoreToolMatch(tool, 'xcodebuild', '')).toBeNull()
    expect(scoreToolMatch(tool, 'xcodebuild', '   ')).toBeNull()
  })

  it('scores exact name matches highest', () => {
    const exact = scoreToolMatch(tool, 'xcodebuild', 'list_sims')
    const partial = scoreToolMatch(tool, 'xcodebuild', 'sims')
    const unrelated = scoreToolMatch(tool, 'xcodebuild', 'zzz')
    expect(exact).not.toBeNull()
    expect(partial).not.toBeNull()
    expect(unrelated).toBeNull()
    expect(exact!).toBeGreaterThan(partial!)
  })

  it('matches camelCase queries against camelCase original names', () => {
    const camel = scoreToolMatch(
      {
        name: 'xcodebuild_showBuildSettings',
        originalName: 'showBuildSettings',
        description: 'Shows build settings',
      },
      'xcodebuild',
      'showBuildSettings',
    )
    expect(camel).not.toBeNull()
  })
})

describe('registry searchTools', () => {
  it('finds tools across servers with ranking', () => {
    const registry = makeRegistry()
    const names = new Map([
      ['server-1', 'xcodebuild'],
      ['server-2', 'github'],
    ])
    const { items, total } = registry.searchTools('list', undefined, names)
    expect(total).toBeGreaterThanOrEqual(2)
    // Both list_sims and list_issues should be found.
    const found = items.map((m) => m.tool.originalName)
    expect(found).toContain('list_sims')
    expect(found).toContain('list_issues')
    // Sorting is by score descending.
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].score).toBeGreaterThanOrEqual(items[i].score)
    }
  })

  it('scopes search to one server', () => {
    const registry = makeRegistry()
    const names = new Map([
      ['server-1', 'xcodebuild'],
      ['server-2', 'github'],
    ])
    const { items, total } = registry.searchTools('list', 'server-1', names)
    expect(total).toBe(1)
    expect(items[0].tool.originalName).toBe('list_sims')
  })

  it('honors limit/offset pagination', () => {
    const registry = makeRegistry()
    const names = new Map([
      ['server-1', 'xcodebuild'],
      ['server-2', 'github'],
    ])
    const first = registry.searchTools('list', undefined, names, 1, 0)
    expect(first.items.length).toBe(1)
    expect(first.hasMore).toBe(true)
    const second = registry.searchTools('list', undefined, names, 1, 1)
    expect(second.items.length).toBe(1)
    expect(second.nextOffset).toBeNull()
  })

  it('coverage gate rejects weak matches', () => {
    const registry = makeRegistry()
    const names = new Map([['server-1', 'xcodebuild']])
    const { total } = registry.searchTools('building skyscrapers', 'server-1', names)
    expect(total).toBe(0)
  })
})

describe('registry findTool', () => {
  it('finds by prefixed or original name', () => {
    const registry = makeRegistry()
    expect(registry.findTool('xcodebuild_list_sims')?.tool.originalName).toBe('list_sims')
    expect(registry.findTool('list_sims')?.tool.originalName).toBe('list_sims')
    expect(registry.findTool('list_sims', 'server-1')?.tool.originalName).toBe('list_sims')
    expect(registry.findTool('list_sims', 'server-2')).toBeUndefined()
    expect(registry.findTool('nope')).toBeUndefined()
  })

  it('returns did-you-mean suggestions', () => {
    const registry = makeRegistry()
    const suggestions = registry.rankSuggestions(
      'xcodebuild_list_sim',
      5,
      new Map([
        ['server-1', 'xcodebuild'],
        ['server-2', 'github'],
      ]),
    )
    expect(suggestions).toContain('xcodebuild_list_sims')
  })
})

describe('paginate', () => {
  it('handles empty input and offsets beyond length', () => {
    expect(paginate([], 0, 10)).toEqual({ items: [], total: 0, hasMore: false, nextOffset: null })
    expect(paginate([1, 2, 3], 100, 10)).toEqual({
      items: [],
      total: 3,
      hasMore: false,
      nextOffset: null,
    })
  })
})
