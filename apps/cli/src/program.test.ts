import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Command } from 'commander'
import {
  createFolder,
  deleteAsset,
  listAssets,
  listProjects,
  moveAssets,
  renameAsset,
} from '@shumai/operations'
import type { CallOperation } from './operations/call-operation'
import { CliError, formatCliError } from './operations/errors'
import { createProgram } from './program'

/** Runs the CLI with mocked Operation calls and captures stdout/stderr. */
function setup() {
  let stdout = ''
  let stderr = ''
  const callOperation = vi.fn<CallOperation>()
  const program = createProgram({
    callOperation,
    output: { out: { write: (s) => void (stdout += s) }, isTty: true, columns: 120 },
  })
  const configure = (cmd: Command) => {
    cmd.exitOverride().configureOutput({
      writeOut: (s) => void (stdout += s),
      writeErr: (s) => void (stderr += s),
    })
    cmd.commands.forEach(configure)
  }
  configure(program)
  return {
    callOperation,
    run: (...argv: string[]) => program.parseAsync(['node', 'shumai-cli', ...argv]),
    stdout: () => stdout,
    stderr: () => stderr,
  }
}

const folder = { id: 'f-1', name: 'Renders', type: 'folder', size: 0, projectId: 'p-1' }

describe('shumai-cli', () => {
  const originalAllowDelete = process.env.SHUMAI_ALLOW_DELETE

  afterEach(() => {
    if (originalAllowDelete === undefined) delete process.env.SHUMAI_ALLOW_DELETE
    else process.env.SHUMAI_ALLOW_DELETE = originalAllowDelete
  })

  describe('project ls', () => {
    it('lists projects with their root folder', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({
        data: [
          { id: 'p1', name: 'Proj 1', teamId: 't1', rootFolderId: 'root1' },
          { id: 'p2', name: 'Proj 2', teamId: 't1', rootFolderId: 'root2' },
        ],
      })

      await cli.run('project', 'ls')

      expect(cli.callOperation).toHaveBeenCalledWith(listProjects, {})
      expect(cli.stdout()).toContain('Root Folder ID')
      expect(cli.stdout()).toMatch(/p1\s+Proj 1\s+root1/)
      expect(cli.stdout()).toContain('Proj 2')
    })

    it('reports when there are no projects', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({ data: [] })

      await cli.run('project', 'ls')

      expect(cli.stdout()).toBe('No projects found.\n')
    })
  })

  describe('ls', () => {
    it('lists a folder with the maximum page size, folders first', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({
        data: [
          { id: 'file1', name: 'doc.pdf', type: 'file', size: 1024, projectId: 'p' },
          { id: 'sub1', name: 'Sub 1', type: 'folder', size: 0, projectId: 'p' },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
        total: 2,
      })

      await cli.run('ls', '-p', 'parentId123')

      expect(cli.callOperation).toHaveBeenCalledWith(listAssets, {
        parent: 'parentId123',
        first: 200,
      })
      const out = cli.stdout()
      expect(out.indexOf('Sub 1')).toBeLessThan(out.indexOf('doc.pdf'))
      expect(out).toMatch(/file1\s+doc\.pdf\s+file\s+1 KB/)
      expect(out).not.toContain('More assets available')
    })

    it('passes pagination and type flags and prints the next-page cursor', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({
        data: [{ id: 'sub1', name: 'Sub 1', type: 'folder', size: 0, projectId: 'p' }],
        pageInfo: { hasNextPage: true, endCursor: 'cur-2' },
        total: 3,
      })

      await cli.run('ls', '--parent', 'p1', '--type', 'folder', '--first', '1', '--after', 'cur-1')

      expect(cli.callOperation).toHaveBeenCalledWith(listAssets, {
        parent: 'p1',
        type: 'folder',
        first: 1,
        after: 'cur-1',
      })
      expect(cli.stdout()).toContain('Next page: --after cur-2')
    })

    it('requires the parent option', async () => {
      const cli = setup()

      await expect(cli.run('ls')).rejects.toThrow()
      expect(cli.stderr()).toContain("required option '-p, --parent <parent>' not specified")
      expect(cli.callOperation).not.toHaveBeenCalled()
    })

    it('rejects an invalid type and a non-numeric page size', async () => {
      const cli = setup()

      await expect(cli.run('ls', '-p', 'x', '--type', 'video')).rejects.toThrow()
      expect(cli.stderr()).toContain('Allowed choices are file, folder, all')

      await expect(cli.run('ls', '-p', 'x', '--first', 'many')).rejects.toThrow()
      expect(cli.stderr()).toContain('Not a number')
      expect(cli.callOperation).not.toHaveBeenCalled()
    })
  })

  describe('mkdir', () => {
    it('creates a folder and prints its ID', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({ ...folder, id: 'new_folder_ulid' })

      await cli.run('mkdir', 'NewFolder', '-p', 'parent_ulid')

      expect(cli.callOperation).toHaveBeenCalledWith(createFolder, {
        name: 'NewFolder',
        parent: 'parent_ulid',
      })
      expect(cli.stdout()).toBe('Created folder with ID: new_folder_ulid\n')
    })

    it('requires a folder name', async () => {
      const cli = setup()

      await expect(cli.run('mkdir', '-p', 'parent_ulid')).rejects.toThrow()
      expect(cli.stderr()).toContain("missing required argument 'name'")
    })
  })

  describe('rename', () => {
    it('renames an asset', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({ ...folder, name: 'Renamed Folder' })

      await cli.run('rename', 'f-1', 'Renamed Folder')

      expect(cli.callOperation).toHaveBeenCalledWith(renameAsset, {
        assetId: 'f-1',
        name: 'Renamed Folder',
      })
      expect(cli.stdout()).toBe('Renamed asset f-1 to "Renamed Folder"\n')
    })

    it('requires both the asset ID and the new name', async () => {
      const cli = setup()

      await expect(cli.run('rename', 'f-1')).rejects.toThrow()
      expect(cli.stderr()).toContain("missing required argument 'name'")
    })
  })

  describe('move', () => {
    it.each(['move', 'mv'])('moves assets with %s', async (command) => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({
        movedAssetIds: ['a-1', 'a-2'],
        newParentId: 'parent-1',
      })

      await cli.run(command, 'a-1', 'a-2', '-p', 'parent-1')

      expect(cli.callOperation).toHaveBeenCalledWith(moveAssets, {
        assetIds: ['a-1', 'a-2'],
        newParentId: 'parent-1',
      })
      expect(cli.stdout()).toBe('Moved 2 asset(s) to parent parent-1\n')
    })

    it('requires at least one asset and a destination', async () => {
      const cli = setup()

      await expect(cli.run('move', '-p', 'parent-1')).rejects.toThrow()
      expect(cli.stderr()).toContain("missing required argument 'assetIds'")

      await expect(cli.run('move', 'a-1')).rejects.toThrow()
      expect(cli.stderr()).toContain("required option '-p, --parent <newParentId>' not specified")
    })
  })

  describe('delete', () => {
    it.each([undefined, 'false'])(
      'refuses to delete when SHUMAI_ALLOW_DELETE is %s',
      async (value) => {
        if (value === undefined) delete process.env.SHUMAI_ALLOW_DELETE
        else process.env.SHUMAI_ALLOW_DELETE = value
        const cli = setup()

        const error = await cli.run('delete', 'a-1').catch((err: unknown) => err)

        expect(formatCliError(error)).toBe(
          'Error: Delete Asset is disabled in this environment. Set SHUMAI_ALLOW_DELETE=true to enable it.',
        )
        expect(cli.callOperation).not.toHaveBeenCalled()
      },
    )

    it.each([
      ['delete', 'true'],
      ['rm', '1'],
    ])('deletes with %s when SHUMAI_ALLOW_DELETE=%s', async (command, value) => {
      process.env.SHUMAI_ALLOW_DELETE = value
      const cli = setup()
      cli.callOperation.mockResolvedValue({ deletedAssetId: 'a-1' })

      await cli.run(command, 'a-1')

      expect(cli.callOperation).toHaveBeenCalledWith(deleteAsset, { assetId: 'a-1' })
      expect(cli.stdout()).toBe('Deleted asset a-1\n')
    })

    it('deletes only one asset at a time', async () => {
      process.env.SHUMAI_ALLOW_DELETE = 'true'
      const cli = setup()

      await expect(cli.run('delete', 'a-1', 'a-2')).rejects.toThrow()
      expect(cli.stderr()).toContain('too many arguments')
      expect(cli.callOperation).not.toHaveBeenCalled()
    })
  })

  describe('--json', () => {
    it('prints the raw Operation output', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue(folder)

      await cli.run('mkdir', 'Renders', '-p', 'root', '--json')

      expect(JSON.parse(cli.stdout())).toEqual(folder)
    })

    it('works before the command too', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({ data: [] })

      await cli.run('--json', 'project', 'ls')

      expect(JSON.parse(cli.stdout())).toEqual({ data: [] })
    })
  })

  describe('errors', () => {
    it('surfaces server errors for the entry point to print', async () => {
      const cli = setup()
      cli.callOperation.mockRejectedValue(new CliError('User is not a member of the team'))

      const error = await cli.run('mkdir', 'x', '-p', 'root').catch((err: unknown) => err)

      expect(formatCliError(error)).toBe('Error: User is not a member of the team')
    })

    it('validates input against the Operation schema before calling the server', async () => {
      const cli = setup()

      const error = await cli.run('mkdir', '', '-p', 'root').catch((err: unknown) => err)

      expect(error).toBeInstanceOf(CliError)
      expect(cli.callOperation).not.toHaveBeenCalled()
    })

    it('suggests similar commands for typos', async () => {
      const cli = setup()

      await expect(cli.run('mkidr', 'x')).rejects.toThrow()
      expect(cli.stderr()).toContain('Did you mean mkdir?')
    })
  })

  describe('help', () => {
    it('lists every command, including generated ones', async () => {
      const cli = setup()

      await expect(cli.run('--help')).rejects.toThrow()

      const help = cli.stdout()
      for (const command of [
        'project',
        'ls',
        'mkdir',
        'rename',
        'move|mv',
        'delete|rm',
        'upload',
        'create-version',
      ]) {
        expect(help).toContain(command)
      }
      expect(help).toContain('--json')
    })

    it('documents generated options from the Operation schema', async () => {
      const cli = setup()

      await expect(cli.run('ls', '--help')).rejects.toThrow()

      const help = cli.stdout()
      expect(help).toContain('-p, --parent <parent>')
      expect(help).toContain('The parent folder ID to list assets from.')
      expect(help).toContain('--type <type>')
      expect(help).toContain('choices: "file", "folder", "all"')
      expect(help).toContain('(default: 200)')
      expect(help).toContain('List the files and folders inside a parent folder.')
    })
  })
})

describe('formatCliError', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('formats expected and unexpected errors', () => {
    expect(formatCliError(new CliError('boom'))).toBe('Error: boom')
    expect(
      formatCliError(new CliError('Error connecting to API server: x', { prefixed: true })),
    ).toBe('Error connecting to API server: x')
    expect(formatCliError(new TypeError('bad'))).toBe('Unexpected error: bad')
  })
})
