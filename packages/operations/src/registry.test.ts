import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import {
  getOperationDefinition,
  getOperationDefinitionsForSurface,
  operationDefinitions,
} from './registry'

describe('operation registry', () => {
  it('has unique names', () => {
    const names = operationDefinitions.map((d) => d.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('contains the asset, project, comment, metadata, version, and upload operations', () => {
    expect(operationDefinitions.map((d) => d.name).sort()).toEqual([
      'complete_upload',
      'copy_assets',
      'create_comment',
      'create_file',
      'create_folder',
      'create_version',
      'create_version_stack',
      'delete_asset',
      'download_asset',
      'get_asset_render',
      'get_folder_instructions',
      'list_assets',
      'list_comments',
      'list_metadata_fields',
      'list_projects',
      'list_versions',
      'move_assets',
      'read_asset',
      'remove_version',
      'rename_asset',
      'resolve_comment',
      'search_assets',
      'update_asset_metadata',
    ])
  })

  it('looks up definitions by name', () => {
    expect(getOperationDefinition('create_folder')?.title).toBe('Create Folder')
    expect(getOperationDefinition('nope')).toBeUndefined()
  })

  it('filters definitions by surface', () => {
    const cli = getOperationDefinitionsForSurface('cli').map((d) => d.name)
    expect(cli).toContain('list_assets')
    expect(cli).toContain('read_asset')
    expect(getOperationDefinitionsForSurface('mcp').map((d) => d.name)).toContain(
      'get_asset_render',
    )
  })

  it('annotates only delete_asset as destructive', () => {
    const destructive = operationDefinitions.filter((d) => d.annotations.destructive)
    expect(destructive.map((d) => d.name)).toEqual(['delete_asset'])
    const readOnly = operationDefinitions.filter((d) => d.annotations.readOnly)
    expect(readOnly.map((d) => d.name).sort()).toEqual([
      'download_asset',
      'get_asset_render',
      'get_folder_instructions',
      'list_assets',
      'list_comments',
      'list_metadata_fields',
      'list_projects',
      'list_versions',
      'read_asset',
      'search_assets',
    ])
  })

  it('exposes uploads on the agent and MCP only, and complete_upload on MCP only', () => {
    // The CLI uploads with its own `upload` and `create-version` commands, and the agent's
    // create tools complete their uploads themselves.
    const surfaces = (name: string) => getOperationDefinition(name)?.surfaces
    expect(surfaces('create_file')).toEqual(['agent', 'mcp'])
    expect(surfaces('create_version')).toEqual(['agent', 'mcp'])
    expect(surfaces('complete_upload')).toEqual(['mcp'])
    const cli = getOperationDefinitionsForSurface('cli').map((d) => d.name)
    expect(cli).not.toContain('create_file')
    expect(cli).not.toContain('complete_upload')
  })

  it.each(operationDefinitions.map((d) => [d.name, d] as const))(
    '%s exports an object JSON Schema with described fields',
    (_name, definition) => {
      const schema = z.toJSONSchema(definition.input, { io: 'input' }) as {
        type: string
        properties: Record<string, { description?: string }>
      }
      expect(schema.type).toBe('object')
      for (const [field, property] of Object.entries(schema.properties)) {
        expect(property.description, `${definition.name}.${field}`).toBeTruthy()
      }
      // Output schemas must also be representable (used as MCP outputSchema)
      expect(() => z.toJSONSchema(definition.output, { io: 'output' })).not.toThrow()
    },
  )

  it.each(operationDefinitions.map((d) => [d.name, d] as const))(
    '%s input schema has no nullable types',
    (_name, definition) => {
      // Tool formats like Gemini's function declarations (an OpenAPI subset) can't express
      // `type: [..., "null"]` or a `null` branch, so inputs use optional fields instead.
      // Surfaces drop nulls that models send for optional fields (dropNullOptionals).
      const schema = JSON.stringify(z.toJSONSchema(definition.input, { io: 'input' }))
      expect(schema).not.toMatch(/"type":\[/)
      expect(schema).not.toContain('"type":"null"')
    },
  )

  it('keeps legacy CLI invocations mapped', () => {
    const commands = operationDefinitions
      .filter((d) => d.cli)
      .map((d) => [d.name, [...(d.cli?.command ?? []), ...(d.cli?.aliases ?? [])]])
    expect(commands).toEqual([
      ['list_projects', ['project', 'ls']],
      ['list_assets', ['ls']],
      ['search_assets', ['search']],
      ['create_folder', ['mkdir']],
      ['rename_asset', ['rename']],
      ['move_assets', ['move', 'mv']],
      ['copy_assets', ['copy', 'cp']],
      ['delete_asset', ['delete', 'rm']],
      ['read_asset', ['read']],
      ['get_asset_render', ['render']],
      ['download_asset', ['download']],
      ['get_folder_instructions', ['instructions']],
      ['list_comments', ['comment', 'ls']],
      ['create_comment', ['comment', 'add']],
      ['resolve_comment', ['comment', 'resolve']],
      ['list_metadata_fields', ['field', 'ls']],
      ['update_asset_metadata', ['meta', 'set']],
      ['create_version_stack', ['version', 'stack']],
      ['list_versions', ['version', 'ls']],
      ['remove_version', ['version', 'unstack']],
    ])
  })

  it('does not depend on server packages', () => {
    const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>
    }
    const deps = Object.keys(pkg.dependencies ?? {})
    expect(deps).not.toContain('@shumai/core')
    expect(deps).not.toContain('@shumai/db')
    expect(deps).not.toContain('@shumai/api')
  })
})
