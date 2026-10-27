import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Command } from 'commander'
import {
  copyAssets,
  createComment,
  createFolder,
  createVersionStack,
  deleteAsset,
  downloadAsset,
  getAssetRender,
  getFolderInstructions,
  readAsset,
  listAssets,
  listComments,
  listMetadataFields,
  listProjects,
  listVersions,
  moveAssets,
  removeVersion,
  renameAsset,
  resolveComment,
  searchAssets,
  updateAssetMetadata,
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

const frames = {
  status: 'ready',
  summary: 'Extracted 2 frame(s) from "clip.mp4" (0s - 4s):',
  asset: { id: 'vid-1', name: 'clip.mp4', kind: 'video', mediaType: 'video/mp4' },
  details: [],
  images: [
    { label: 'Frame at 0s', mimeType: 'image/webp', url: 'https://files.example/0.webp' },
    { label: 'Frame at 4s', mimeType: 'image/webp', url: 'https://files.example/4.webp' },
  ],
}

const pendingRead = {
  status: 'pending',
  summary: 'Rendering is still in progress for "clip.mp4".',
  asset: frames.asset,
  details: [],
  images: [],
  taskId: 'task-1',
  retryAfterSeconds: 5,
}

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

  describe('read', () => {
    it('maps flattened reader flags onto the config objects and prints image links', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue(frames)

      await cli.run(
        'read',
        'vid-1',
        '--video-start',
        '0',
        '--video-end',
        '4',
        '--video-count',
        '2',
        '--annotation-id',
        'c-1',
      )

      expect(cli.callOperation).toHaveBeenCalledWith(readAsset, {
        assetId: 'vid-1',
        annotationId: 'c-1',
        videoConfig: { start: 0, end: 4, count: 2 },
      })
      expect(cli.stdout()).toBe(
        [
          'Extracted 2 frame(s) from "clip.mp4" (0s - 4s):',
          '- Frame at 0s: https://files.example/0.webp',
          '- Frame at 4s: https://files.example/4.webp',
          '',
        ].join('\n'),
      )
    })

    it.each([
      [
        ['--doc-mode', 'pages', '--doc-start-page', '1', '--doc-end-page', '3'],
        { docConfig: { mode: 'pages', startPage: 1, endPage: 3 } },
      ],
      [['--doc-mode', 'text'], { docConfig: { mode: 'text' } }],
      [['--degree', '90'], { config3d: { degree: 90 } }],
      [[], {}],
    ])('reads with %j', async (flags, config) => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({ ...frames, images: [] })

      await cli.run('read', 'a-1', ...flags)

      expect(cli.callOperation).toHaveBeenCalledWith(readAsset, { assetId: 'a-1', ...config })
    })

    it('names the flag that is missing from a reader config', async () => {
      const cli = setup()

      const error = await cli
        .run('read', 'vid-1', '--video-start', '0', '--video-count', '2')
        .catch((err: unknown) => err)

      expect(formatCliError(error)).toContain('--video-end')
      expect(cli.callOperation).not.toHaveBeenCalled()
    })

    it('prints text content after the summary', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({
        ...frames,
        summary: 'Document "notes.md" (ID: d-1):',
        images: [],
        text: {
          content: '# Notes\nhello',
          truncated: true,
          size: 90000,
          mimeType: 'text/markdown',
        },
      })

      await cli.run('read', 'd-1', '--doc-mode', 'text')

      expect(cli.stdout()).toBe(
        'Document "notes.md" (ID: d-1):\n\n# Notes\nhello\n\n[Content truncated: showing the first part of a 90000-byte file. Run `shumai-cli download vid-1` to get the whole file.]\n',
      )
    })

    it('returns right away with --no-wait and prints the render command', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue(pendingRead)

      await cli.run(
        'read',
        'vid-1',
        '--video-start',
        '0',
        '--video-end',
        '4',
        '--video-count',
        '2',
        '--no-wait',
        '--out',
        'frames',
      )

      expect(cli.callOperation).toHaveBeenCalledWith(readAsset, {
        assetId: 'vid-1',
        videoConfig: { start: 0, end: 4, count: 2 },
        maxWaitSeconds: 0,
      })
      expect(cli.stdout()).toBe(
        'Rendering is still in progress for "clip.mp4".\nRun this to get the result: shumai-cli render task-1 --out "frames"\n',
      )
    })

    it('prints the raw output with --json', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue(frames)

      await cli.run('--json', 'read', 'vid-1')

      expect(JSON.parse(cli.stdout())).toEqual(frames)
    })
  })

  describe('render', () => {
    it('fetches a pending render by task ID', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue(frames)

      await cli.run('render', 'task-1')

      expect(cli.callOperation).toHaveBeenCalledWith(getAssetRender, { taskId: 'task-1' })
      expect(cli.stdout()).toContain('- Frame at 4s: https://files.example/4.webp')
    })

    it('checks once with --no-wait', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue(pendingRead)

      await cli.run('render', 'task-1', '--no-wait')

      expect(cli.callOperation).toHaveBeenCalledWith(getAssetRender, {
        taskId: 'task-1',
        maxWaitSeconds: 0,
      })
      expect(cli.stdout()).toContain('Run this to get the result: shumai-cli render task-1\n')
    })
  })

  describe('download', () => {
    it('downloads the web previews by default, or the originals with --original', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({ files: [] })

      await cli.run('download', 'a-1', 'a-2')
      expect(cli.callOperation).toHaveBeenLastCalledWith(downloadAsset, {
        assetIds: ['a-1', 'a-2'],
      })

      await cli.run('download', 'a-1', '--original')
      expect(cli.callOperation).toHaveBeenLastCalledWith(downloadAsset, {
        assetIds: ['a-1'],
        proxy: false,
      })
    })

    it('requires at least one asset ID and documents its options', async () => {
      const cli = setup()

      await expect(cli.run('download')).rejects.toThrow()
      expect(cli.stderr()).toContain("missing required argument 'assetIds'")

      await expect(cli.run('download', '--help')).rejects.toThrow()
      expect(cli.stdout()).toContain('-o, --out <dir>')
      expect(cli.stdout()).toContain('--original')
      expect(cli.stdout()).not.toContain('--proxy')
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
        'read',
        'render',
        'download',
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

    it('documents flattened reader options for read', async () => {
      const cli = setup()

      await expect(cli.run('read', '--help')).rejects.toThrow()

      const help = cli.stdout()
      for (const flag of [
        '--video-start <start>',
        '--video-end <end>',
        '--video-count <count>',
        '--doc-mode <mode>',
        '--doc-start-page <startPage>',
        '--doc-end-page <endPage>',
        '--degree <degree>',
        '--annotation-id <annotationId>',
        '-o, --out <dir>',
        '--no-wait',
      ]) {
        expect(help).toContain(flag)
      }
      expect(help).not.toContain('--include-content')
      expect(help).not.toContain('--image')
    })
  })

  describe('search', () => {
    it('searches a folder by name with the maximum page size', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({
        data: [{ id: 'f1', name: 'sunset.png', type: 'file', size: 10, projectId: 'p' }],
        pageInfo: { hasNextPage: false, endCursor: null },
        total: 1,
      })

      await cli.run('search', 'sunset', '-p', 'root-1')

      expect(cli.callOperation).toHaveBeenCalledWith(searchAssets, {
        parent: 'root-1',
        query: 'sunset',
        first: 200,
      })
      expect(cli.stdout()).toContain('sunset.png')
    })

    it('searches by meaning with --semantic', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({
        data: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        total: 0,
      })

      await cli.run('search', 'a calm beach', '-p', 'root-1', '--semantic')

      expect(cli.callOperation).toHaveBeenCalledWith(
        searchAssets,
        expect.objectContaining({ query: 'a calm beach', semantic: true }),
      )
    })
  })

  describe('copy', () => {
    it.each(['copy', 'cp'])('copies assets with %s', async (command) => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({ copiedAssetIds: ['c-1', 'c-2'], newParentId: 'f-2' })

      await cli.run(command, 'a-1', 'a-2', '-p', 'f-2', '--with-comments')

      expect(cli.callOperation).toHaveBeenCalledWith(copyAssets, {
        assetIds: ['a-1', 'a-2'],
        newParentId: 'f-2',
        withComments: true,
      })
      expect(cli.stdout()).toBe('Copied 2 asset(s) to parent f-2: c-1, c-2\n')
    })
  })

  describe('comment', () => {
    const thread = {
      id: 'c-1',
      message: 'Too dark here',
      author: { id: 'u-1', name: 'Ana' },
      second: 12.5,
      hasMarkup: false,
      attachmentCount: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      resolved: true,
      replies: [
        {
          id: 'c-2',
          message: 'Fixed in v2',
          author: { id: 'u-2', name: 'Bo' },
          second: null,
          hasMarkup: false,
          attachmentCount: 0,
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    }

    it('lists threads with their replies', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({
        data: [thread],
        pageInfo: { hasNextPage: false, endCursor: null },
        total: 1,
      })

      await cli.run('comment', 'ls', 'vid-1')

      expect(cli.callOperation).toHaveBeenCalledWith(listComments, {
        assetId: 'vid-1',
        first: 200,
      })
      expect(cli.stdout()).toBe(
        'c-1 @12.5s [resolved] Ana: Too dark here\n  ↳ c-2 Bo: Fixed in v2\n',
      )
    })

    it('posts a reply at a timecode', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({ id: 'c-3', assetId: 'vid-1', replyToId: 'c-1' })

      await cli.run('comment', 'add', 'vid-1', 'Looks good now', '--reply-to', 'c-1', '--at', '3')

      expect(cli.callOperation).toHaveBeenCalledWith(createComment, {
        assetId: 'vid-1',
        message: 'Looks good now',
        replyToId: 'c-1',
        second: 3,
      })
      expect(cli.stdout()).toBe('Posted comment c-3\n')
    })

    it('resolves and reopens comments', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValueOnce({ commentId: 'c-1', resolved: true })
      cli.callOperation.mockResolvedValueOnce({ commentId: 'c-1', resolved: false })

      await cli.run('comment', 'resolve', 'c-1')
      await cli.run('comment', 'resolve', 'c-1', '--reopen')

      expect(cli.callOperation).toHaveBeenNthCalledWith(1, resolveComment, { commentId: 'c-1' })
      expect(cli.callOperation).toHaveBeenNthCalledWith(2, resolveComment, {
        commentId: 'c-1',
        reopen: true,
      })
      expect(cli.stdout()).toBe('Comment c-1 is resolved\nComment c-1 is unresolved\n')
    })
  })

  describe('meta set', () => {
    it('passes --values as a JSON object', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({ assetId: 'a-1', updatedKeys: ['status', 'rating'] })

      await cli.run('meta', 'set', 'a-1', '--values', '{"status":"approved","rating":4}')

      expect(cli.callOperation).toHaveBeenCalledWith(updateAssetMetadata, {
        assetId: 'a-1',
        values: { status: 'approved', rating: 4 },
      })
      expect(cli.stdout()).toBe('Updated status, rating on a-1\n')
    })

    it.each([
      ['{not json', 'Not valid JSON.'],
      ['["status"]', 'Expected a JSON object'],
    ])('rejects --values %s', async (value, message) => {
      const cli = setup()

      await expect(cli.run('meta', 'set', 'a-1', '--values', value)).rejects.toThrow()
      expect(cli.stderr()).toContain(message)
      expect(cli.callOperation).not.toHaveBeenCalled()
    })
  })

  describe('field ls', () => {
    it("lists a project's fields with their choices", async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValue({
        fields: [
          {
            key: 'status',
            name: 'Status',
            type: 'select',
            description: '',
            readOnly: false,
            creationContext: false,
            options: [{ id: 'approved', name: 'Approved' }],
          },
          {
            key: 'prompt',
            name: 'Prompt',
            type: 'text',
            description: '',
            readOnly: false,
            creationContext: true,
          },
        ],
      })

      await cli.run('field', 'ls', 'p-1')

      expect(cli.callOperation).toHaveBeenCalledWith(listMetadataFields, { projectId: 'p-1' })
      expect(cli.stdout()).toBe(
        'status  Status (select) [approved=Approved]\nprompt  Prompt (text, creation)\n',
      )
    })
  })

  describe('version', () => {
    it('stacks files, lists versions, and unstacks one', async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValueOnce({
        id: 's-1',
        name: 'cut_v2.mp4',
        type: 'version_stack',
        size: 20,
        projectId: 'p-1',
      })
      cli.callOperation.mockResolvedValueOnce({
        versions: [
          {
            id: 'v-2',
            version: 2,
            name: 'cut_v2.mp4',
            current: true,
            createdAt: '2026-01-02T00:00:00.000Z',
            creator: null,
            agent: null,
          },
          {
            id: 'v-1',
            version: 1,
            name: 'cut_v1.mp4',
            current: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            creator: null,
            agent: null,
          },
        ],
      })
      cli.callOperation.mockResolvedValueOnce({ versionId: 'v-1', stackId: 's-1' })

      await cli.run('version', 'stack', 'v-2', 'v-1')
      await cli.run('version', 'ls', 's-1')
      await cli.run('version', 'unstack', 'v-1')

      expect(cli.callOperation).toHaveBeenNthCalledWith(1, createVersionStack, {
        fileIds: ['v-2', 'v-1'],
      })
      expect(cli.callOperation).toHaveBeenNthCalledWith(2, listVersions, { stackId: 's-1' })
      expect(cli.callOperation).toHaveBeenNthCalledWith(3, removeVersion, { versionId: 'v-1' })
      expect(cli.stdout()).toBe(
        'Created version stack s-1\n' +
          'v2 (current)  v-2  cut_v2.mp4\nv1  v-1  cut_v1.mp4\n' +
          'Removed v-1 from version stack s-1\n',
      )
    })
  })

  describe('instructions', () => {
    it("prints a folder's instructions, or says it has none", async () => {
      const cli = setup()
      cli.callOperation.mockResolvedValueOnce({ folderId: 'f-1', content: '# Rules' })
      cli.callOperation.mockResolvedValueOnce({ folderId: 'f-2', content: null })

      await cli.run('instructions', 'f-1')
      await cli.run('instructions', 'f-2')

      expect(cli.callOperation).toHaveBeenCalledWith(getFolderInstructions, { folderId: 'f-1' })
      expect(cli.stdout()).toBe('# Rules\n(This folder has no instructions.)\n')
    })
  })

  it('has no upload Operation commands: upload and create-version stream local files', () => {
    const program = createProgram({ callOperation: vi.fn<CallOperation>() })
    const names = program.commands.map((c) => c.name())
    expect(names).not.toContain('complete-upload')
    expect(names.filter((n) => n === 'create-version')).toHaveLength(1)
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
