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

  it('contains the initial asset and project operations', () => {
    expect(operationDefinitions.map((d) => d.name).sort()).toEqual([
      'create_folder',
      'delete_asset',
      'list_assets',
      'list_projects',
      'move_assets',
      'rename_asset',
    ])
  })

  it('looks up definitions by name', () => {
    expect(getOperationDefinition('create_folder')?.title).toBe('Create Folder')
    expect(getOperationDefinition('nope')).toBeUndefined()
  })

  it('filters definitions by surface', () => {
    const cli = getOperationDefinitionsForSurface('cli').map((d) => d.name)
    expect(cli).toContain('list_assets')
  })

  it('annotates only delete_asset as destructive', () => {
    const destructive = operationDefinitions.filter((d) => d.annotations.destructive)
    expect(destructive.map((d) => d.name)).toEqual(['delete_asset'])
    const readOnly = operationDefinitions.filter((d) => d.annotations.readOnly)
    expect(readOnly.map((d) => d.name).sort()).toEqual(['list_assets', 'list_projects'])
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

  it('keeps legacy CLI invocations mapped', () => {
    const commands = operationDefinitions.map((d) => [
      d.name,
      [...(d.cli?.command ?? []), ...(d.cli?.aliases ?? [])],
    ])
    expect(commands).toEqual([
      ['list_projects', ['project', 'ls']],
      ['list_assets', ['ls']],
      ['create_folder', ['mkdir']],
      ['rename_asset', ['rename']],
      ['move_assets', ['move', 'mv']],
      ['delete_asset', ['delete', 'rm']],
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
